"""watsonx.ai scoring — generates block-level heat island insights via IBM Granite."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from functools import lru_cache
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

MODEL_ID = "ibm/granite-3-8b-instruct"

# Vulnerability is stored and passed on the 0–100 scale.
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

# JSON extractor — pull the first {...} from any model output
_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


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
    # No stop_sequences — they can prematurely truncate JSON output.
    params = TextGenParameters(
        max_new_tokens=512,
        temperature=0.05,
    )
    return ModelInference(
        model_id=MODEL_ID,
        api_client=client,
        params=params,
    )


def _classify_risk(vulnerability_score: float | None, lst_mean_c: float | None) -> str:
    """Rule-based risk level on the 0–100 vulnerability scale."""
    score = vulnerability_score or 0.0
    lst = lst_mean_c or 0.0
    if score >= 75 or lst >= 38:
        return "critical"
    if score >= 55 or lst >= 34:
        return "high"
    if score >= 35 or lst >= 30:
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
            "Plant street trees to increase canopy cover by at least 20%",
            "Install cool or green roofs on flat commercial and residential buildings",
            "Replace impervious pavement with permeable surfaces to reduce heat retention",
        ],
        "confidence": "low",
        "source": "rules_fallback",
    }


def _sync_score(prompt: str) -> dict[str, Any]:
    """Synchronous SDK call — run via executor to avoid blocking the event loop."""
    model = _get_model()
    response = model.generate_text(prompt=prompt)
    raw = response.strip() if isinstance(response, str) else str(response)

    # Robustly extract the first JSON object from the output
    match = _JSON_RE.search(raw)
    if not match:
        raise ValueError(f"No JSON found in model output: {raw[:200]!r}")
    return json.loads(match.group())


async def score_block_ml(block_features: dict[str, Any]) -> dict[str, Any] | None:
    """
    Call watsonx.ai Granite to generate heat island insights for a block.
    Returns None when AI scoring is disabled. Falls back to rule-based when the
    SDK call fails so the endpoint never errors out.

    Runs the blocking SDK call in a thread-pool executor to avoid stalling
    the asyncio event loop.
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
        loop = asyncio.get_running_loop()
        result: dict[str, Any] = await loop.run_in_executor(None, _sync_score, prompt)
        result["source"] = "watsonx_granite"
        result["model"] = MODEL_ID
        return result

    except json.JSONDecodeError as e:
        logger.warning("Granite returned unparseable JSON (%s); using rule-based fallback.", e)
        return _fallback_response(block_features)
    except Exception:
        logger.exception("watsonx.ai call failed; using rule-based fallback.")
        return _fallback_response(block_features)
