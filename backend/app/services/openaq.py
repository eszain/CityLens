"""OpenAQ latest measurements for a bounding box (Toronto default) via API v3."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

OPENAQ_V3_BASE = "https://api.openaq.org/v3"
# OpenAQ parameter ids (stable in v3): 2 = PM2.5, 3 = PM10
_PM25_ID = 2
_PM10_ID = 3
_RECENT_DAYS = 7
_LOC_PAGE_SIZE = 500
_LATEST_CONCURRENCY = 12


def _parse_bbox(bbox: str) -> tuple[float, float, float, float]:
    parts = [float(x.strip()) for x in bbox.split(",")]
    if len(parts) != 4:
        raise ValueError("bbox must be min_lon,min_lat,max_lon,max_lat")
    return parts[0], parts[1], parts[2], parts[3]


def _parse_utc(s: str) -> datetime | None:
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except (TypeError, ValueError):
        return None


def _sensor_param_by_id(location: dict) -> dict[int, dict]:
    out: dict[int, dict] = {}
    for s in location.get("sensors") or []:
        sid = s.get("id")
        param = s.get("parameter")
        if sid is not None and isinstance(param, dict):
            out[int(sid)] = param
    return out


def _pick_pollutants(
    latest_rows: list[dict],
    sensor_param: dict[int, dict],
) -> tuple[float | None, float | None, datetime | None]:
    """From /locations/{id}/latest rows, take newest PM2.5 and PM10 by sensor."""
    best_pm25: tuple[datetime, float] | None = None
    best_pm10: tuple[datetime, float] | None = None

    for row in latest_rows:
        sid = row.get("sensorsId")
        if sid is None:
            continue
        param = sensor_param.get(int(sid))
        if not param:
            continue
        pid = param.get("id")
        if pid not in (_PM25_ID, _PM10_ID):
            continue
        raw_val = row.get("value")
        if raw_val is None:
            continue
        try:
            val = float(raw_val)
        except (TypeError, ValueError):
            continue
        if val < 0:
            continue
        dt_s = (row.get("datetime") or {}).get("utc")
        dt = _parse_utc(dt_s) if isinstance(dt_s, str) else None
        if dt is None:
            continue

        if pid == _PM25_ID:
            if best_pm25 is None or dt > best_pm25[0]:
                best_pm25 = (dt, val)
        elif pid == _PM10_ID:
            if best_pm10 is None or dt > best_pm10[0]:
                best_pm10 = (dt, val)

    pm25 = best_pm25[1] if best_pm25 else None
    pm10 = best_pm10[1] if best_pm10 else None
    times = [t for t in (best_pm25 and best_pm25[0], best_pm10 and best_pm10[0]) if t]
    observed = max(times) if times else None
    return pm25, pm10, observed


async def _fetch_location_latest(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    headers: dict[str, str],
    location: dict,
    datetime_min: str,
) -> dict | None:
    loc_id = location.get("id")
    if loc_id is None:
        return None
    coords = location.get("coordinates") or {}
    lat, lon = coords.get("latitude"), coords.get("longitude")
    if lat is None or lon is None:
        return None

    sensor_param = _sensor_param_by_id(location)
    url = f"{OPENAQ_V3_BASE}/locations/{int(loc_id)}/latest"
    params = {"datetime_min": datetime_min, "limit": 100, "page": 1}

    async with sem:
        try:
            r = await client.get(url, params=params, headers=headers)
            r.raise_for_status()
            payload = r.json()
        except Exception as exc:  # noqa: BLE001
            logger.debug("OpenAQ location %s latest failed: %s", loc_id, exc)
            return None

    rows = payload.get("results") or []
    pm25, pm10, observed = _pick_pollutants(rows, sensor_param)
    if observed is None and pm25 is None and pm10 is None:
        return None

    name = location.get("name") or str(loc_id)
    obs = observed or datetime.now(tz=UTC)
    return {
        "location_id": loc_id,
        "name": name,
        "lon": float(lon),
        "lat": float(lat),
        "pm25": pm25,
        "pm10": pm10,
        "datetime": obs,
        "raw": {"location": location, "latest": payload},
    }


async def fetch_latest_locations(
    bbox: str | None = None,
    limit: int = 200,
) -> list[dict]:
    """
    List OpenAQ locations in bbox (PM2.5-capable), then attach the newest PM2.5/PM10
    from each location's /latest feed within the last few days.
    """
    if not settings.openaq_api_key:
        logger.warning("OPENAQ_API_KEY is required for OpenAQ v3; skipping ingest.")
        return []

    bbox_s = (bbox or settings.toronto_bbox).strip()
    _parse_bbox(bbox_s)  # validate
    headers = {"X-API-Key": settings.openaq_api_key}
    datetime_min = (datetime.now(tz=UTC) - timedelta(days=_RECENT_DAYS)).date().isoformat()

    out: list[dict] = []
    page = 1
    sem = asyncio.Semaphore(_LATEST_CONCURRENCY)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            while len(out) < limit:
                try:
                    lr = await client.get(
                        f"{OPENAQ_V3_BASE}/locations",
                        params={
                            "bbox": bbox_s,
                            "parameters_id": str(_PM25_ID),
                            "limit": _LOC_PAGE_SIZE,
                            "page": page,
                        },
                        headers=headers,
                    )
                    lr.raise_for_status()
                    loc_payload = lr.json()
                except Exception as exc:  # noqa: BLE001
                    logger.warning("OpenAQ v3 locations fetch failed (page %s): %s", page, exc)
                    break

                locs = loc_payload.get("results") or []
                if not locs:
                    break

                tasks = [
                    _fetch_location_latest(client, sem, headers, loc, datetime_min)
                    for loc in locs
                ]
                batch = await asyncio.gather(*tasks)
                for row in batch:
                    if row is not None:
                        out.append(row)
                        if len(out) >= limit:
                            break

                page += 1

    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenAQ v3 ingest client error: %s", exc)

    return out[:limit]
