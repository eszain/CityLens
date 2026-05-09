"""OpenAQ latest measurements for a bounding box (Toronto default)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

OPENAQ_V2_LATEST = "https://api.openaq.org/v2/latest"


def _parse_bbox(bbox: str) -> tuple[float, float, float, float]:
    parts = [float(x.strip()) for x in bbox.split(",")]
    if len(parts) != 4:
        raise ValueError("bbox must be min_lon,min_lat,max_lon,max_lat")
    return parts[0], parts[1], parts[2], parts[3]


def _in_bbox(lon: float, lat: float, bbox: tuple[float, float, float, float]) -> bool:
    min_lon, min_lat, max_lon, max_lat = bbox
    return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat


async def fetch_latest_locations(
    bbox: str | None = None,
    limit: int = 200,
) -> list[dict]:
    """
    Pull OpenAQ v2 /latest and filter to bbox. PM2.5 chosen when multiple params exist.
    """
    bbox_t = _parse_bbox(bbox or settings.toronto_bbox)
    headers: dict[str, str] = {}
    if settings.openaq_api_key:
        headers["X-API-Key"] = settings.openaq_api_key

    out: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            r = await client.get(
                OPENAQ_V2_LATEST,
                params={"limit": min(10000, max(500, limit * 50))},
                headers=headers,
            )
            r.raise_for_status()
            payload = r.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenAQ v2 latest fetch failed: %s", exc)
        return out

    for row in payload.get("results", []):
        coords = row.get("coordinates") or {}
        lon = coords.get("longitude")
        lat = coords.get("latitude")
        if lon is None or lat is None:
            continue
        lon_f, lat_f = float(lon), float(lat)
        if not _in_bbox(lon_f, lat_f, bbox_t):
            continue

        pm25 = None
        pm10 = None
        for m in row.get("measurements", []) or []:
            p = str(m.get("parameter", "")).lower()
            val = m.get("value")
            if p in ("pm25", "pm2.5"):
                pm25 = val
            if p == "pm10":
                pm10 = val

        out.append(
            {
                "location_id": row.get("location"),
                "name": row.get("location"),
                "lon": lon_f,
                "lat": lat_f,
                "pm25": pm25,
                "pm10": pm10,
                "datetime": datetime.now(tz=UTC),
                "raw": row,
            }
        )
        if len(out) >= limit:
            break

    return out
