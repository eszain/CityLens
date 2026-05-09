"""Equity metrics from demographics + deployment snapshots."""

from __future__ import annotations

from typing import Any


def summarize_equity(blocks: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Compute a simple resource equity score:
    correlation between vulnerability and resource deployment for low-income flagged blocks.
    """
    if not blocks:
        return {
            "equity_score": None,
            "low_income_blocks": 0,
            "under_resourced_alerts": 0,
            "mean_vuln_low_income": None,
            "mean_deploy_low_income": None,
        }

    low = [b for b in blocks if b.get("low_income_flag")]
    under = 0
    for b in low:
        vuln = float(b.get("vulnerability_score") or 0)
        dep = float(b.get("resources_deployed") or 0)
        if vuln >= 70 and dep < 0.25:
            under += 1

    vulns = [float(b.get("vulnerability_score") or 0) for b in low]
    deps = [float(b.get("resources_deployed") or 0) for b in low]
    mean_v = sum(vulns) / len(vulns) if vulns else None
    mean_d = sum(deps) / len(deps) if deps else None

    # Crude 0–1 score: higher when deployments track vulnerability among low-income blocks.
    equity_score = None
    if mean_v is not None and mean_v > 1 and mean_d is not None:
        equity_score = max(0.0, min(1.0, mean_d / (mean_v / 100.0)))

    return {
        "equity_score": round(equity_score, 4) if equity_score is not None else None,
        "low_income_blocks": len(low),
        "under_resourced_alerts": under,
        "mean_vuln_low_income": round(mean_v, 2) if mean_v is not None else None,
        "mean_deploy_low_income": round(mean_d, 4) if mean_d is not None else None,
    }
