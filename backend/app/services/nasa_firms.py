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
    Fetch MODIS NRT hotspots via FIRMS area CSV for the configured city bbox
    (same bounds used when filtering rows on ingest). Requires NASA FIRMS MAP_KEY.
    """
    key = settings.nasa_firms_map_key
    if not key:
        logger.info("NASA_FIRMS_MAP_KEY not set; skipping FIRMS ingest.")
        return []

    # Area CSV: /api/area/csv/{MAP_KEY}/{SOURCE}/{west,south,east,north}/{day_range}
    # (Country-by-name codes are error-prone; Canada country queries are discouraged by FIRMS.)
    bbox = settings.toronto_bbox.replace(" ", "")
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/MODIS_NRT/{bbox}/{days}"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            text = r.text
    except Exception as exc:  # noqa: BLE001
        detail = ""
        if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
            detail = (exc.response.text or "")[:500]
        logger.warning("FIRMS CSV fetch failed: %s %s", exc, detail)
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
