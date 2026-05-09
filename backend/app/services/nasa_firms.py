"""NASA FIRMS MODIS/VIIRS hotspots — auxiliary heat signals (not block LST)."""

from __future__ import annotations

import csv
import io
import logging
from datetime import UTC, datetime

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def fetch_modis_hotspots_csv(days: int = 1) -> list[dict]:
    """
    Fetch MODIS hotspots via FIRMS Area CSV export (west,south,east,north).

    The **country/csv** endpoint is disabled by NASA; use **area/csv** instead
    (https://firms.modaps.eosdis.nasa.gov/api/area/). Requires ``NASA_FIRMS_MAP_KEY``.

    ``TORONTO_BBOX`` (min_lon,min_lat,max_lon,max_lat) matches FIRMS area order
    (west,south,east,north). Day range is clamped to 1–5 per API limits.
    """
    key = settings.nasa_firms_map_key
    if not key:
        logger.info("NASA_FIRMS_MAP_KEY not set; skipping FIRMS ingest.")
        return []

    parts = [p.strip() for p in settings.toronto_bbox.split(",")]
    if len(parts) != 4:
        logger.warning("Invalid TORONTO_BBOX (expected 4 comma-separated numbers); skipping FIRMS.")
        return []
    try:
        west, south, east, north = (float(x) for x in parts)
    except ValueError:
        logger.warning("Invalid TORONTO_BBOX values; skipping FIRMS.")
        return []

    day_range = min(max(int(days), 1), 5)
    # /api/area/csv/[MAP_KEY]/[SOURCE]/[west,south,east,north]/[DAY_RANGE]
    area = f"{west},{south},{east},{north}"
    base = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
    url = f"{base}/{key}/MODIS_NRT/{area}/{day_range}"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            text = r.text
    except Exception as exc:  # noqa: BLE001
        logger.warning("FIRMS CSV fetch failed: %s", exc)
        return []

    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict] = []
    for row in reader:
        try:
            lat = float(row.get("latitude") or row.get("Latitude") or row.get("lat") or 0)
            lon = float(row.get("longitude") or row.get("Longitude") or row.get("lon") or 0)
        except (TypeError, ValueError):
            continue
        rows.append(
            {
                "lat": lat,
                "lon": lon,
                "brightness": _float(row.get("brightness") or row.get("brightness_temp")),
                "scan": _float(row.get("scan")),
                "track": _float(row.get("track")),
                "acq_date": row.get("acq_date") or row.get("date"),
                "acq_time": row.get("acq_time") or row.get("time"),
                "raw": dict(row),
            }
        )
    return rows


def _float(v: object) -> float | None:
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def parse_firms_datetime(row: dict) -> datetime:
    """Best-effort FIRMS acquisition timestamp."""
    d = row.get("acq_date") or "1970-01-01"
    t = str(row.get("acq_time") or "0000").zfill(4)
    try:
        hh = int(t[:2])
        mm = int(t[2:4])
        return datetime.fromisoformat(f"{d}T{hh:02d}:{mm:02d}:00").replace(tzinfo=UTC)
    except Exception:  # noqa: BLE001
        return datetime.now(tz=UTC)
