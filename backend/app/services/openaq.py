"""OpenAQ latest measurements for a bounding box (Toronto default)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

OPENAQ_V3_LOCATIONS = "https://api.openaq.org/v3/locations"


def _parse_utc(dt_str: str | None) -> datetime | None:
    if not dt_str:
        return None
    cleaned = dt_str.replace("Z", "+00:00")
    return datetime.fromisoformat(cleaned)


def _extract_pm_from_sensors(sensors: list) -> tuple[float | None, float | None, datetime]:
    pm25: float | None = None
    pm10: float | None = None
    pm25_dt: datetime | None = None
    pm10_dt: datetime | None = None

    for sens in sensors or []:
        param = (sens.get("parameter") or {}).get("name")
        name = str(param or "").lower()
        latest = sens.get("latest") or {}
        val = latest.get("value")
        if val is None:
            continue
        dt_raw = (latest.get("datetime") or {}).get("utc")
        dt_parsed = _parse_utc(dt_raw) if dt_raw else None
        try:
            v = float(val)
        except (TypeError, ValueError):
            continue

        if name in ("pm25", "pm2.5"):
            pm25 = v
            pm25_dt = dt_parsed
        elif name == "pm10":
            pm10 = v
            pm10_dt = dt_parsed

    dts = [d for d in (pm25_dt, pm10_dt) if d is not None]
    observed_at = max(dts) if dts else datetime.now(tz=UTC)
    return pm25, pm10, observed_at


async def fetch_latest_locations(
    bbox: str | None = None,
    limit: int = 200,
) -> list[dict]:
    """
    Pull OpenAQ v3 /v3/locations (bbox filter). PM2.5 / PM10 from sensor ``latest`` fields.

    OpenAQ v1/v2 were retired in 2025; v3 requires ``OPENAQ_API_KEY``.
    """
    bbox_str = (bbox or settings.toronto_bbox).strip()
    headers: dict[str, str] = {}
    if settings.openaq_api_key:
        headers["X-API-Key"] = settings.openaq_api_key
    else:
        logger.warning(
            "OpenAQ v3 requires OPENAQ_API_KEY (register at https://openaq.org/) — skipping fetch",
        )
        return []

    out: list[dict] = []
    page_limit = min(1000, max(100, limit * 5))
    page = 1

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            while len(out) < limit and page <= 50:
                r = await client.get(
                    OPENAQ_V3_LOCATIONS,
                    params={
                        "bbox": bbox_str,
                        "limit": page_limit,
                        "page": page,
                    },
                    headers=headers,
                )
                r.raise_for_status()
                payload = r.json()
                rows = payload.get("results") or []
                if not rows:
                    break

                for row in rows:
                    coords = row.get("coordinates") or {}
                    lat = coords.get("latitude")
                    lon = coords.get("longitude")
                    if lat is None or lon is None:
                        continue
                    lon_f, lat_f = float(lon), float(lat)

                    pm25, pm10, observed_at = _extract_pm_from_sensors(row.get("sensors") or [])

                    loc_id = row.get("id")
                    name = row.get("name") or str(loc_id)

                    out.append(
                        {
                            "location_id": loc_id,
                            "name": name,
                            "lon": lon_f,
                            "lat": lat_f,
                            "pm25": pm25,
                            "pm10": pm10,
                            "datetime": observed_at,
                            "raw": row,
                        }
                    )
                    if len(out) >= limit:
                        break

                if len(rows) < page_limit:
                    break
                page += 1

    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenAQ v3 locations fetch failed: %s", exc)
        return out

    return out
