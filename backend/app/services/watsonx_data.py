"""
watsonx.data lakehouse bridge — archives ingest payloads to IBM COS and
exports gold-layer block features for ML training/inference jobs.

Storage layout in COS bucket (citylens-archive):
  {kind}/YYYY-MM-DD/{uuid}.json   ← raw ingest snapshots (archive_payload)
  exports/{city_slug}/features_{timestamp}.json  ← gold-layer ML export
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# COS client — lazy init, cached per process
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _get_cos_client():
    """
    Build an ibm_boto3 S3 client pointed at IBM COS.
    Returns None when COS credentials are absent so callers degrade gracefully.
    """
    if not settings.cos_api_key or not settings.cos_instance_crn:
        return None

    import ibm_boto3
    from ibm_botocore.client import Config

    return ibm_boto3.client(
        "s3",
        ibm_api_key_id=settings.cos_api_key,
        ibm_service_instance_id=settings.cos_instance_crn,
        config=Config(signature_version="oauth"),
        endpoint_url=settings.cos_endpoint,
    )


def _cos_available() -> bool:
    return _get_cos_client() is not None


def _upload(key: str, body: str) -> None:
    """Upload a UTF-8 string to COS. Raises on failure."""
    client = _get_cos_client()
    if client is None:
        raise RuntimeError("COS client not initialised (missing credentials)")
    client.put_object(
        Bucket=settings.cos_bucket,
        Key=key,
        Body=body.encode("utf-8"),
        ContentType="application/json",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def archive_payload(kind: str, payload: dict[str, Any]) -> None:
    """
    Archive a raw ingest snapshot to IBM COS under:
      {kind}/YYYY-MM-DD/{uuid}.json

    Called after each successful ingest (OpenAQ, FIRMS, Sentinel, equity).
    Silently skips when COS is not configured so ingest endpoints never fail.
    """
    if not _cos_available():
        logger.debug("COS not configured — skipping archive for kind=%s", kind)
        return

    now = datetime.now(tz=timezone.utc)
    date_prefix = now.strftime("%Y-%m-%d")
    object_key = f"{kind}/{date_prefix}/{uuid.uuid4()}.json"

    body = json.dumps(
        {
            "kind": kind,
            "archived_at": now.isoformat(),
            "payload": payload,
        },
        default=str,
    )

    try:
        _upload(object_key, body)
        logger.info("Archived %s → cos://%s/%s", kind, settings.cos_bucket, object_key)
    except Exception:
        logger.exception("COS archive failed for kind=%s — continuing without archive", kind)


async def export_features_for_ml(
    city_slug: str,
    conn=None,
) -> dict[str, Any]:
    """
    Build and optionally upload a gold-layer feature export to COS.

    When `conn` (asyncpg connection) is provided, pulls live block features
    from Supabase. Otherwise returns an empty stub so the function is safe
    to call without a DB connection.

    COS key: exports/{city_slug}/features_{YYYYMMDD_HHMMSS}.json
    """
    rows: list[dict[str, Any]] = []

    if conn is not None:
        try:
            db_rows = await conn.fetch(
                """
                SELECT
                    b.id::text            AS block_id,
                    b.external_id,
                    b.lst_mean_c,
                    b.canopy_pct,
                    b.vulnerability_score,
                    b.scoring_model_version,
                    d.income_median_cad,
                    d.low_income_flag,
                    (
                        SELECT a.pm25
                        FROM air_quality_readings a
                        WHERE a.city_id = b.city_id
                        ORDER BY ST_Distance(
                            a.location::geography,
                            ST_Centroid(b.geom)::geography
                        ) ASC NULLS LAST
                        LIMIT 1
                    ) AS pm25
                FROM blocks b
                JOIN cities c ON c.id = b.city_id
                LEFT JOIN LATERAL (
                    SELECT income_median_cad, low_income_flag
                    FROM demographics dem
                    WHERE dem.block_id = b.id
                    ORDER BY census_year DESC
                    LIMIT 1
                ) d ON true
                WHERE c.slug = $1
                ORDER BY b.external_id
                LIMIT 10000
                """,
                city_slug,
            )
            rows = [dict(r) for r in db_rows]
        except Exception:
            logger.exception("DB query failed in export_features_for_ml")

    now = datetime.now(tz=timezone.utc)
    export = {
        "city": city_slug,
        "exported_at": now.isoformat(),
        "rows": len(rows),
        "schema": ["block_id", "external_id", "lst_mean_c", "canopy_pct",
                   "vulnerability_score", "income_median_cad", "low_income_flag", "pm25"],
        "features": rows,
    }

    if _cos_available() and rows:
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        object_key = f"exports/{city_slug}/features_{timestamp}.json"
        try:
            _upload(object_key, json.dumps(export, default=str))
            logger.info(
                "Exported %d feature rows → cos://%s/%s",
                len(rows), settings.cos_bucket, object_key,
            )
            export["cos_key"] = object_key
        except Exception:
            logger.exception("COS upload failed for feature export — returning in-memory result")
    elif not _cos_available():
        logger.debug("COS not configured — feature export is in-memory only")
        export["note"] = "COS not configured — add COS_API_KEY + COS_INSTANCE_CRN to persist to lakehouse"

    return export
