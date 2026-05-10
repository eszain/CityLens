"""Featherless AI scoring — generates block-level heat island insights via open-source models."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx
from app.config import settings

logger = logging.getLogger(__name__)

# JSON extractor — pull the first {...} from any model output
_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)

_PROMPT_TEMPLATE = """\
You are an urban heat island analyst. Given block-level sensor data, produce a concise JSON analysis.

Block data:
- Land Surface Temperature: {lst_mean_c:.1f}°C
- Tree canopy cover: {canopy_pct:.1f}%
- PM2.5 air quality: {pm25_str}
- Composite vulnerability score: {vulnerability_score:.1f}/100 (0=low risk, 100=maximum risk)

Heat risk thresholds:
- critical: vulnerability ≥ 75 or LST ≥ 38°C
- high:     vulnerability ≥ 55 or LST ≥ 34°C
- moderate: vulnerability ≥ 35 or LST ≥ 30°C
- low:      below all thresholds

Respond ONLY with valid JSON in exactly this shape (no markdown, no extra text):
{{"heat_risk":"low|moderate|high|critical","summary":"<2-sentence plain-English summary for a city planner>","top_interventions":["<action 1>","<action 2>","<action 3>"],"confidence":"low|medium|high"}}
"""

async def score_block_featherless(block_features: dict[str, Any]) -> dict[str, Any] | None:
    """
    Call Featherless AI (OpenAI-compatible) to generate heat island insights for a block.
    """
    if not settings.enable_ai_scoring:
        return None
    
    if not settings.featherless_api_key:
        logger.warning("FEATHERLESS_API_KEY missing — skipping Featherless scoring.")
        return None

    lst = block_features.get("lst_mean_c")
    canopy = block_features.get("canopy_pct")
    pm25 = block_features.get("pm25")
    vuln = block_features.get("vulnerability_score")

    prompt = _PROMPT_TEMPLATE.format(
        lst_mean_c=lst if lst is not None else 0.0,
        canopy_pct=canopy if canopy is not None else 0.0,
        pm25_str=f"{pm25:.1f} µg/m³" if pm25 is not None else "unavailable",
        vulnerability_score=vuln if vuln is not None else 0.0,
    )

    url = "https://api.featherless.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.featherless_api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": settings.featherless_model,
        "messages": [
            {"role": "system", "content": [{"type": "text", "text": "You are a helpful urban planning assistant that outputs strict JSON."}]},
            {"role": "user", "content": [{"type": "text", "text": prompt}]}
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            
            content = data["choices"][0]["message"]["content"]
            
            # Robustly extract the first JSON object
            match = _JSON_RE.search(content)
            if not match:
                raise ValueError(f"No JSON found in model output")
            
            result = json.loads(match.group())
            result["source"] = "featherless_ai"
            result["model"] = settings.featherless_model
            return result

    except Exception as e:
        logger.exception(f"Featherless AI call failed: {e}")
        return None
