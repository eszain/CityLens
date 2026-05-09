"""Sentinel Hub OAuth + catalog/process placeholders for LST / thermal derivatives."""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Legacy Sentinel Hub (services.sentinel-hub.com OAuth).
_LEGACY_AUTH_URL = "https://services.sentinel-hub.com/oauth/token"
_LEGACY_CATALOG_SEARCH_URL = "https://services.sentinel-hub.com/api/v1/catalog/1.0.0/search"

# Copernicus Data Space Ecosystem — OAuth client from https://shapps.dataspace.copernicus.eu/dashboard/
_CDSE_AUTH_URL = (
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
)
_CDSE_CATALOG_SEARCH_URL = "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search"


def _oauth_and_catalog_urls() -> tuple[str, str]:
    s = settings
    if s.sentinel_hub_oauth_url and s.sentinel_hub_catalog_search_url:
        return s.sentinel_hub_oauth_url, s.sentinel_hub_catalog_search_url
    if s.sentinel_hub_use_cdse:
        return _CDSE_AUTH_URL, _CDSE_CATALOG_SEARCH_URL
    return _LEGACY_AUTH_URL, _LEGACY_CATALOG_SEARCH_URL

# Hub occasionally returns transient errors; retries avoid failing the whole ingest on brief blips.
_CATALOG_RETRY_STATUSES = frozenset({429, 502, 503, 504})
_CATALOG_MAX_ATTEMPTS = 4


async def get_access_token() -> str | None:
    cid = (settings.sentinel_hub_client_id or "").strip()
    csec = (settings.sentinel_hub_client_secret or "").strip()
    if not cid or not csec:
        logger.info("Sentinel Hub credentials not set; skipping.")
        return None
    auth_url, _ = _oauth_and_catalog_urls()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                auth_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": cid,
                    "client_secret": csec,
                },
            )
            if r.is_error:
                # Keycloak returns JSON e.g. invalid_client — log body for debugging 401s.
                logger.warning(
                    "Sentinel Hub token failed: HTTP %s %s",
                    r.status_code,
                    (r.text or "")[:500],
                )
                return None
            return str(r.json().get("access_token"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sentinel Hub token failed: %s", exc)
        return None


def _retry_after_seconds(response: httpx.Response) -> float | None:
    try:
        ra = response.headers.get("retry-after")
        if ra is None:
            return None
        return float(ra)
    except (TypeError, ValueError):
        return None


async def search_sentinel_items(
    bbox: tuple[float, float, float, float],
    collection: str = "sentinel-3-slstr",
    max_items: int = 5,
) -> list[dict]:
    """
    Minimal STAC search against Sentinel Hub catalog (requires token).
    bbox: min_lon, min_lat, max_lon, max_lat in EPSG:4326.
    """
    token = await get_access_token()
    if not token:
        return []

    min_lon, min_lat, max_lon, max_lat = bbox
    end_d = date.today()
    start_d = end_d - timedelta(days=14)
    # Catalog v1.0.0 requires ISO-8601 datetimes, not date-only (see Sentinel Hub examples).
    start_iso = datetime(
        start_d.year, start_d.month, start_d.day, 0, 0, 0, tzinfo=timezone.utc
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    end_iso = datetime(
        end_d.year, end_d.month, end_d.day, 23, 59, 59, tzinfo=timezone.utc
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    body = {
        "bbox": [min_lon, min_lat, max_lon, max_lat],
        "datetime": f"{start_iso}/{end_iso}",
        "collections": [collection],
        "limit": max_items,
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    _, catalog_url = _oauth_and_catalog_urls()

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            for attempt in range(_CATALOG_MAX_ATTEMPTS):
                try:
                    r = await client.post(catalog_url, json=body, headers=headers)
                except httpx.HTTPError as exc:
                    if attempt + 1 < _CATALOG_MAX_ATTEMPTS:
                        delay = min(2.0**attempt, 30.0)
                        logger.warning(
                            "Sentinel catalog request error (attempt %s/%s), retry in %.1fs: %s",
                            attempt + 1,
                            _CATALOG_MAX_ATTEMPTS,
                            delay,
                            exc,
                        )
                        await asyncio.sleep(delay)
                        continue
                    logger.warning("Sentinel catalog search failed after retries: %s", exc)
                    return []

                if r.status_code in _CATALOG_RETRY_STATUSES and attempt + 1 < _CATALOG_MAX_ATTEMPTS:
                    delay = _retry_after_seconds(r) or min(2.0**attempt, 30.0)
                    snippet = (r.text or "")[:300].replace("\n", " ")
                    logger.warning(
                        "Sentinel catalog returned HTTP %s (transient); retry in %.1fs (%s/%s). Body: %s",
                        r.status_code,
                        delay,
                        attempt + 1,
                        _CATALOG_MAX_ATTEMPTS,
                        snippet,
                    )
                    await asyncio.sleep(delay)
                    continue

                if r.is_success:
                    data = r.json()
                    return list(data.get("features") or [])

                detail = (r.text or "")[:500]
                logger.warning(
                    "Sentinel catalog search failed: HTTP %s %s",
                    r.status_code,
                    detail,
                )
                return []
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sentinel catalog search failed: %s", exc)
        return []

    return []


async def estimate_lst_placeholder(bbox: tuple[float, float, float, float]) -> float | None:
    """
    Placeholder zonal LST (°C): replace with Process API evalscript + aggregation.
    Returns None when Hub is not configured.
    """
    items = await search_sentinel_items(bbox)
    if not items:
        return None
    # Stub mean — real implementation runs evalscript and zonal stats per block.
    return 28.5
