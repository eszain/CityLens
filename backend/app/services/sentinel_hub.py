"""Sentinel Hub OAuth + catalog/process placeholders for LST / thermal derivatives."""

from __future__ import annotations

import logging
from datetime import date, timedelta

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

AUTH_URL = "https://services.sentinel-hub.com/oauth/token"
CATALOG_URL = "https://services.sentinel-hub.com/api/v1/catalog/search"


async def get_access_token() -> str | None:
    cid = settings.sentinel_hub_client_id
    csec = settings.sentinel_hub_client_secret
    if not cid or not csec:
        logger.info("Sentinel Hub credentials not set; skipping.")
        return None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                AUTH_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": cid,
                    "client_secret": csec,
                },
            )
            r.raise_for_status()
            return str(r.json().get("access_token"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sentinel Hub token failed: %s", exc)
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
    end = date.today()
    start = end - timedelta(days=14)
    body = {
        "bbox": [min_lon, min_lat, max_lon, max_lat],
        "datetime": f"{start.isoformat()}/{end.isoformat()}",
        "collections": [collection],
        "limit": max_items,
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            r = await client.post(
                CATALOG_URL,
                json=body,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
            r.raise_for_status()
            data = r.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sentinel catalog search failed: %s", exc)
        return []

    return list(data.get("features") or [])


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
