"""watsonx.ai scoring — generates block-level heat island insights via IBM Granite."""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

MODEL_ID = "ibm/granite-3-8b-instruct"

_PROMPT_TEMPLATE = """\
You are an urban heat island analyst. Given block-level sensor data, produce a concise JSON analysis.

Block data:
- Land Surface Temperature: {lst_mean_c:.1f}°C
- Tree canopy cover: {canopy_pct:.1f}%
- PM2.5 air quality: {pm25_str}
- Composite vulnerability score: {vulnerability_score:.2f} (0=low, 1=high)

Respond ONLY with valid JSON in exactly this shape (no markdown, no explanation):
{{
  "heat_risk": "low|moderate|high|critical",
  "summary": "<2-sentence plain-English summary for a city planner>",
  "top_interventions": ["<action 1>", "<action 2>", "<action 3>"],
  "confidence": "low|medium|high"
}}
"""


@lru_cache(maxsize=1)
def _get_model():
    """Lazily initialize the watsonx.ai ModelInference client (cached)."""
    from ibm_watsonx_ai import APIClient, Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference
    from ibm_watsonx_ai.foundation_models.schema import TextGenParameters

    credentials = Credentials(
        url=settings.watsonx_url,
        api_key=settings.watsonx_api_key,
    )
    client = APIClient(credentials, project_id=settings.watsonx_project_id)
    params = TextGenParameters(
        max_new_tokens=400,
        temperature=0.1,
        stop_sequences=["\n\n"],
    )
    return ModelInference(
        model_id=MODEL_ID,
        api_client=client,
        params=params,
    )


def _classify_risk(vulnerability_score: float | None, lst_mean_c: float | None) -> str:
    score = vulnerability_score or 0.0
    lst = lst_mean_c or 0.0
    if score >= 0.75 or lst >= 38:
        return "critical"
    if score >= 0.55 or lst >= 34:
        return "high"
    if score >= 0.35 or lst >= 30:
        return "moderate"
    return "low"


def _fallback_response(features: dict[str, Any]) -> dict[str, Any]:
    """Rule-based fallback when watsonx is unavailable."""
    risk = _classify_risk(features.get("vulnerability_score"), features.get("lst_mean_c"))
    canopy = features.get("canopy_pct") or 0
    lst = features.get("lst_mean_c") or 0
    return {
        "heat_risk": risk,
        "summary": (
            f"Block shows {risk} heat island risk with {lst:.1f}°C surface temperature "
            f"and {canopy:.1f}% canopy cover. "
            f"{'Immediate intervention recommended.' if risk in ('high', 'critical') else 'Monitor seasonal trends.'}"
        ),
        "top_interventions": [
            "Plant street trees to increase canopy cover",
            "Install cool/green roofs on high-albedo surfaces",
            "Add permeable pavement to reduce heat retention",
        ],
        "confidence": "low",
        "source": "rules_fallback",
    }


async def score_block_ml(block_features: dict[str, Any]) -> dict[str, Any] | None:
    """
    Call watsonx.ai Granite to generate heat island insights for a block.
    Returns None when AI scoring is disabled. Falls back to rule-based when the
    SDK call fails so the endpoint never errors out.
    """
    if not settings.enable_ai_scoring:
        return None
    if not settings.watsonx_api_key or not settings.watsonx_project_id or not settings.watsonx_url:
        logger.warning("ENABLE_AI_SCORING=true but watsonx credentials incomplete — skipping ML.")
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

    try:
        model = _get_model()
        response = model.generate_text(prompt=prompt)
        raw = response.strip() if isinstance(response, str) else str(response)

        # Strip any accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result: dict[str, Any] = json.loads(raw)
        result["source"] = "watsonx_granite"
        result["model"] = MODEL_ID
        return result

    except json.JSONDecodeError:
        logger.warning("watsonx returned non-JSON output; using rule-based fallback.")
        return _fallback_response(block_features)
    except Exception:
        logger.exception("watsonx.ai call failed; using rule-based fallback.")
        return _fallback_response(block_features)
