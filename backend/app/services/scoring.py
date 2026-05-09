"""Rule-based heat vulnerability and intervention ROI (MVP)."""

from __future__ import annotations

import math
from typing import Any

INTERVENTION_DEFAULTS: dict[str, dict[str, float]] = {
    "tree_canopy": {"cost_cad": 45000, "temp_delta_c": 0.35},
    "cool_roof": {"cost_cad": 28000, "temp_delta_c": 0.55},
    "permeable_pavement": {"cost_cad": 62000, "temp_delta_c": 0.22},
}


def clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def rule_based_vulnerability(block: dict[str, Any]) -> float:
    """
    Composite score 0–100 from available block attributes.
    Higher = more vulnerable (hotter, lower canopy, worse air when present).
    """
    lst = block.get("lst_mean_c")
    canopy = block.get("canopy_pct")
    pm25 = block.get("pm25")

    heat_component = 50.0
    if lst is not None:
        # Interpret LST relative to a rough urban baseline (°C).
        heat_component = clamp((float(lst) - 22.0) * 8.0 + 40.0)

    canopy_component = 50.0
    if canopy is not None:
        canopy_component = clamp(90.0 - float(canopy) * 1.2)

    air_component = 40.0
    if pm25 is not None:
        air_component = clamp(float(pm25) * 6.0)

    score = 0.45 * heat_component + 0.35 * canopy_component + 0.20 * air_component
    return round(clamp(score), 2)


def intervention_roi_rows(block_id: str, block: dict[str, Any]) -> list[dict[str, Any]]:
    """Return ranked interventions with cost, projected °C reduction, and ROI score."""
    vuln = float(block.get("vulnerability_score") or rule_based_vulnerability(block))
    rows: list[dict[str, Any]] = []
    for itype, cfg in INTERVENTION_DEFAULTS.items():
        cost = cfg["cost_cad"]
        temp_delta = cfg["temp_delta_c"]
        # Scale benefit up slightly for higher vulnerability blocks.
        adj_temp = temp_delta * (0.85 + 0.003 * vuln)
        roi = (adj_temp / max(cost, 1.0)) * 1_000_000
        rows.append(
            {
                "block_id": block_id,
                "intervention_type": itype,
                "cost_estimate_cad": round(cost, 2),
                "projected_temp_reduction_c": round(adj_temp, 4),
                "roi_score": round(roi, 4),
            }
        )
    rows.sort(key=lambda r: r["roi_score"], reverse=True)
    return rows


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0
    p = math.pi / 180
    a = (
        0.5
        - math.cos((lat2 - lat1) * p) / 2
        + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    )
    return 2 * r * math.asin(math.sqrt(a))
