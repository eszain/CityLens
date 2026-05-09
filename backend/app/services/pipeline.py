"""
Granite TTM heat forecasting + AutoAI feature correlation + risk score computation.

TTM (ibm/granite-ttm-512-96-r2):
  - City-level hourly brightness temperature forecast, 96 h horizon.
  - Client is cached after first init; SDK calls run in a thread-pool executor.

AutoAI:
  - Expensive training job (~20-40 min on watsonx.ai). NOT called per request.
  - Triggered via POST /risk-scores/train; results cached in _CACHED_WEIGHTS.

compute_risk_scores:
  - Blends AutoAI feature weights + TTM forecast peak into a 0-100 block risk score.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)

TTM_MODEL_ID = "ibm/granite-ttm-512-96-r2"
TTM_CONTEXT_LEN = 512
TTM_HORIZON = 96

# Feature weights — seeded with rule-based priors; updated after AutoAI completes.
_CACHED_WEIGHTS: dict[str, float] = {
    "lst_mean_c": 0.45,
    "canopy_pct": 0.35,
    "pm25": 0.20,
}
_AUTOAI_RUNNING = False


# ---------------------------------------------------------------------------
# Granite TTM — time series forecasting
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _get_ts_model():
    """Lazily build and cache the TSModelInference client."""
    from ibm_watsonx_ai import Credentials
    from ibm_watsonx_ai.foundation_models import TSModelInference
    from ibm_watsonx_ai.foundation_models.schema import TSForecastParameters

    credentials = Credentials(
        url=settings.watsonx_url,
        api_key=settings.watsonx_api_key,
    )
    params = TSForecastParameters(
        timestamp_column="timestamp",
        freq="1h",
        target_columns=["brightness_temp"],
        conditional_columns=["pm25"],
    )
    return TSModelInference(
        model_id=TTM_MODEL_ID,
        credentials=credentials,
        project_id=settings.watsonx_project_id,
        params=params,
    )


def build_city_timeseries(
    hotspots_df: pd.DataFrame,
    air_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Aggregate FIRMS hotspots + OpenAQ into an hourly time series for TTM input.
    Pads to TTM_CONTEXT_LEN points using a diurnal temperature model when
    real observations are sparse (common early in a deployment).
    """
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)

    if not hotspots_df.empty and "observed_at" in hotspots_df.columns:
        ts = hotspots_df.copy()
        ts["timestamp"] = pd.to_datetime(ts["observed_at"]).dt.floor("h")
        hourly = (
            ts.groupby("timestamp")["brightness"]
            .mean()
            .reset_index()
            .rename(columns={"brightness": "brightness_temp"})
        )
    else:
        hourly = pd.DataFrame(columns=["timestamp", "brightness_temp"])

    if not air_df.empty and "observed_at" in air_df.columns and "pm25" in air_df.columns:
        aq = air_df.copy()
        aq["timestamp"] = pd.to_datetime(aq["observed_at"]).dt.floor("h")
        aq_hourly = aq.groupby("timestamp")["pm25"].mean().reset_index()
        hourly = hourly.merge(aq_hourly, on="timestamp", how="left")
    else:
        hourly["pm25"] = 15.0

    # Pad to TTM_CONTEXT_LEN with a synthetic diurnal baseline
    n_existing = len(hourly)
    if n_existing < TTM_CONTEXT_LEN:
        n_pad = TTM_CONTEXT_LEN - n_existing
        base_brightness = float(hourly["brightness_temp"].iloc[0]) if n_existing > 0 else 305.0
        base_pm25 = float(hourly["pm25"].mean()) if n_existing > 0 else 15.0

        pad_ts = [now - timedelta(hours=TTM_CONTEXT_LEN - i) for i in range(n_pad)]
        # Simple diurnal: peak at 14:00 UTC, trough at 04:00 UTC, ±3 K amplitude
        diurnal = np.sin(np.array([(t.hour - 14) * math.pi / 12 for t in pad_ts]))
        rng = np.random.default_rng(seed=42)
        pad_df = pd.DataFrame(
            {
                "timestamp": pad_ts,
                "brightness_temp": base_brightness + 3.0 * diurnal,
                "pm25": (base_pm25 + rng.normal(0, 1, n_pad)).clip(0, 500),
            }
        )
        hourly = pd.concat([pad_df, hourly], ignore_index=True)

    hourly = hourly.sort_values("timestamp").tail(TTM_CONTEXT_LEN).reset_index(drop=True)
    hourly["pm25"] = hourly["pm25"].fillna(15.0)
    return hourly


def run_heat_forecast(city_ts_df: pd.DataFrame) -> pd.DataFrame | None:
    """
    Call Granite TTM to get a TTM_HORIZON-step (96 h) brightness forecast.
    Returns None when watsonx is unconfigured or the call fails so that the
    risk-score endpoint degrades gracefully.
    """
    if not (settings.watsonx_api_key and settings.watsonx_project_id and settings.watsonx_url):
        logger.debug("watsonx not configured — skipping TTM forecast")
        return None
    try:
        model = _get_ts_model()
        result = model.forecast(data=city_ts_df, future_exogenous_available=False)
        return result
    except Exception:
        logger.exception("Granite TTM forecast failed; continuing without forecast")
        return None


# ---------------------------------------------------------------------------
# AutoAI — feature importance (offline, long-running)
# ---------------------------------------------------------------------------


def run_correlation_model(blocks_df: pd.DataFrame) -> dict[str, float]:
    """
    AutoAI REGRESSION to find which block features drive vulnerability most.
    Updates _CACHED_WEIGHTS in-place. ~20-40 min on watsonx.ai.

    Call only from a background task (POST /risk-scores/train).
    """
    global _CACHED_WEIGHTS, _AUTOAI_RUNNING

    if _AUTOAI_RUNNING:
        logger.info("AutoAI already running; returning current cached weights")
        return dict(_CACHED_WEIGHTS)

    if not (settings.watsonx_api_key and settings.watsonx_project_id):
        logger.warning("watsonx credentials missing — cannot run AutoAI")
        return dict(_CACHED_WEIGHTS)

    _AUTOAI_RUNNING = True
    try:
        from ibm_watsonx_ai import Credentials
        from ibm_watsonx_ai.experiment import AutoAI

        credentials = Credentials(
            url=settings.watsonx_url,
            api_key=settings.watsonx_api_key,
        )
        training_df = blocks_df[["lst_mean_c", "canopy_pct", "pm25", "vulnerability_score"]].dropna()
        if len(training_df) < 10:
            logger.warning("Too few rows (%d) for AutoAI; keeping defaults", len(training_df))
            return dict(_CACHED_WEIGHTS)

        experiment = AutoAI(credentials, project_id=settings.watsonx_project_id)
        optimizer = experiment.optimizer(
            name="CityLens Heat Drivers",
            prediction_type=AutoAI.PredictionType.REGRESSION,
            prediction_column="vulnerability_score",
            scoring=AutoAI.Metrics.R2_SCORE,
            max_number_of_estimators=3,
        )
        optimizer.fit(training_data_reference=[training_df], training_results_reference=None)

        pipeline = optimizer.get_pipeline()
        feature_names = ["lst_mean_c", "canopy_pct", "pm25"]
        importances = dict(zip(feature_names, pipeline.feature_importances_[: len(feature_names)]))
        total = sum(importances.values()) or 1.0
        _CACHED_WEIGHTS = {k: round(v / total, 3) for k, v in importances.items()}
        logger.info("AutoAI weights updated: %s", _CACHED_WEIGHTS)
        return dict(_CACHED_WEIGHTS)

    except Exception:
        logger.exception("AutoAI run failed; keeping previous weights")
        return dict(_CACHED_WEIGHTS)
    finally:
        _AUTOAI_RUNNING = False


def get_feature_weights() -> dict[str, float]:
    """Return current feature weights (AutoAI-derived or seeded defaults)."""
    return dict(_CACHED_WEIGHTS)


# ---------------------------------------------------------------------------
# Risk score computation
# ---------------------------------------------------------------------------


def _norm(series: pd.Series) -> pd.Series:
    lo, hi = series.min(), series.max()
    if hi == lo:
        return pd.Series(0.5, index=series.index, dtype=float)
    return (series - lo) / (hi - lo)


def compute_risk_scores(
    blocks_df: pd.DataFrame,
    feature_weights: dict[str, float],
    forecast_df: pd.DataFrame | None,
) -> pd.DataFrame:
    """
    Blend AutoAI feature weights + optional Granite TTM peak into a 0-100
    risk score per city block.

    Output columns:
      block_id, lat, lon, risk_score, forecast_peak_normalized,
      forecast_peak_temp_k, lst_mean_c, canopy_pct, pm25, vulnerability_score
    """
    df = blocks_df.copy()

    lst_norm = _norm(df["lst_mean_c"].fillna(df["lst_mean_c"].median()))
    canopy_norm = 1.0 - _norm(df["canopy_pct"].fillna(df["canopy_pct"].median()))
    pm25_norm = _norm(df["pm25"].fillna(15.0))

    w_lst = feature_weights.get("lst_mean_c", 0.45)
    w_canopy = feature_weights.get("canopy_pct", 0.35)
    w_pm25 = feature_weights.get("pm25", 0.20)

    if forecast_df is not None and not forecast_df.empty and "brightness_temp" in forecast_df.columns:
        # Normalise the forecast within its own range (avoids Kelvin vs °C comparison).
        # forecast_peak_normalized = how elevated the peak is relative to the forecast swing.
        fc_vals = forecast_df["brightness_temp"].dropna()
        peak_temp = float(fc_vals.max())
        base_temp = float(fc_vals.min())
        peak_range = max(peak_temp - base_temp, 0.01)
        forecast_peak_normalized = float(min(1.0, max(0.0, (peak_temp - base_temp) / peak_range)))

        df["forecast_peak_normalized"] = forecast_peak_normalized
        df["forecast_peak_temp_k"] = peak_temp

        w_forecast = 0.30
        total_w = w_lst + w_canopy + w_pm25 + w_forecast
        df["risk_score"] = (
            w_lst * lst_norm
            + w_canopy * canopy_norm
            + w_pm25 * pm25_norm
            + w_forecast * forecast_peak_normalized
        ) / total_w * 100
    else:
        df["forecast_peak_normalized"] = None
        df["forecast_peak_temp_k"] = None
        total_w = w_lst + w_canopy + w_pm25
        df["risk_score"] = (
            w_lst * lst_norm + w_canopy * canopy_norm + w_pm25 * pm25_norm
        ) / total_w * 100

    df["risk_score"] = df["risk_score"].round(1).clip(0, 100)

    out_cols = [
        "block_id",
        "lat",
        "lon",
        "risk_score",
        "forecast_peak_normalized",
        "forecast_peak_temp_k",
        "lst_mean_c",
        "canopy_pct",
        "pm25",
        "vulnerability_score",
    ]
    return df[[c for c in out_cols if c in df.columns]]
