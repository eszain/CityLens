"""GET /risk-scores — block-level heat risk powered by Granite TTM + AutoAI."""

from __future__ import annotations

import asyncio
import logging
import math
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Query

from app.deps import DbConn
from app.services.data_loader import load_all_sources
from app.services.pipeline import (
    build_city_timeseries,
    compute_risk_scores,
    get_feature_weights,
    run_correlation_model,
    run_heat_forecast,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/risk-scores", tags=["risk-scores"])


def _sanitise(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Replace NaN/inf with None so FastAPI can serialise to JSON."""
    for r in records:
        for k, v in r.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                r[k] = None
    return records


@router.get("", response_model=None)
async def get_risk_scores(
    conn: DbConn,
    city: str = Query("toronto", description="City slug"),
) -> list[dict[str, Any]]:
    """
    Per-block heat risk scores (0-100).

    Pipeline:
    1. Load blocks + FIRMS hotspots + air quality from DB.
    2. Build city-level hourly time series (pads sparse data with diurnal baseline).
    3. Run Granite TTM-512-96 for a 96-hour brightness forecast (optional — degrades
       gracefully when watsonx is unavailable).
    4. Blend AutoAI feature weights (or sensible defaults) + TTM peak into risk scores.
    """
    blocks_df, hotspots_df, air_df = await load_all_sources(conn, city_slug=city)

    if blocks_df.empty:
        return []

    loop = asyncio.get_running_loop()

    city_ts = await loop.run_in_executor(None, build_city_timeseries, hotspots_df, air_df)
    forecast_df = await loop.run_in_executor(None, run_heat_forecast, city_ts)

    weights = get_feature_weights()
    scores_df = compute_risk_scores(blocks_df, weights, forecast_df)

    records = scores_df.to_dict(orient="records")
    return _sanitise(records)


@router.post("/train", status_code=202)
async def train_correlation_model(
    background_tasks: BackgroundTasks,
    conn: DbConn,
    city: str = Query("toronto"),
) -> dict[str, str]:
    """
    Dispatch an AutoAI regression job in the background to learn which block
    features (LST, canopy, PM2.5) best predict vulnerability.

    The job takes 20-40 min on watsonx.ai. Feature weights update automatically
    on completion and are used by subsequent GET /risk-scores calls.
    """
    blocks_df, _, _ = await load_all_sources(conn, city_slug=city)

    def _run_autoai() -> None:
        weights = run_correlation_model(blocks_df)
        logger.info("AutoAI training complete — new weights: %s", weights)

    background_tasks.add_task(_run_autoai)
    return {
        "status": "training_started",
        "message": (
            "AutoAI job dispatched. Feature weights will update automatically "
            "on completion (~20-40 min). GET /risk-scores uses updated weights immediately."
        ),
    }
