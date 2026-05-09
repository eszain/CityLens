"""watsonx.data lakehouse bridge — batch archives & exports (stub).

Archive thermal tiles, OpenAQ dumps, and Sentinel metadata off Supabase hot paths.
Implement IBM Iceberg / COS connectors here when provisioning watsonx.data.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def archive_payload(kind: str, payload: dict[str, Any]) -> None:
    """No-op stub: replace with PUT to lakehouse bucket + catalog registration."""
    logger.debug("watsonx.data archive skipped (%s keys=%s)", kind, list(payload.keys())[:10])


async def export_features_for_ml(city_slug: str) -> dict[str, Any]:
    """Gold-layer features for watsonx.ai training/inference jobs."""
    return {"city": city_slug, "rows": 0, "note": "stub — query lakehouse or replicate from Supabase"}
