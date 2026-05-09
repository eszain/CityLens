"""Optional watsonx.ai scoring — disabled unless ENABLE_AI_SCORING=true."""

from __future__ import annotations

import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


async def score_block_ml(block_features: dict[str, Any]) -> dict[str, Any] | None:
    """
    Placeholder for watsonx.ai inference. Returns None when disabled or unconfigured.
    When enabled, replace this stub with IBM Cloud ML / watsonx deployment calls.
    """
    if not settings.enable_ai_scoring:
        return None
    if not settings.watsonx_api_key or not settings.watsonx_project_id:
        logger.warning("ENABLE_AI_SCORING set but watsonx credentials missing; skipping ML.")
        return None

    logger.info("watsonx scoring stub (configure deployment endpoint): keys=%s", list(block_features.keys()))
    return None
