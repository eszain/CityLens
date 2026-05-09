from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.config import settings
from app.deps import DbConn
from app.services.equity import summarize_equity

router = APIRouter(prefix="/equity", tags=["equity"])


async def _city_id(conn, slug: str) -> UUID:
    row = await conn.fetchrow("SELECT id FROM cities WHERE slug = $1", slug)
    if not row:
        raise HTTPException(status_code=404, detail=f"City not found: {slug}")
    return row["id"]


@router.get("/report")
async def equity_report(
    conn: DbConn,
    city: str = Query("toronto"),
    export_format: str = Query("json", pattern="^(json|csv)$"),
) -> Any:
    """
    Equity summary from latest snapshots joined with block/demographics context.
    """
    cid = await _city_id(conn, city)
    rows = await conn.fetch(
        """
        SELECT b.id::text AS block_id, b.external_id, b.name,
               b.vulnerability_score,
               d.income_median_cad, d.low_income_flag,
               e.resources_deployed, e.equity_score, e.alert_under_resourced, e.snapshot_date
        FROM blocks b
        LEFT JOIN demographics d ON d.block_id = b.id AND d.census_year = (
            SELECT MAX(census_year) FROM demographics d2 WHERE d2.block_id = b.id
        )
        LEFT JOIN LATERAL (
            SELECT * FROM equity_snapshots es
            WHERE es.block_id = b.id AND es.city_id = b.city_id
            ORDER BY es.snapshot_date DESC NULLS LAST LIMIT 1
        ) e ON true
        WHERE b.city_id = $1
        """,
        cid,
    )
    blocks = [dict(r) for r in rows]
    summary = summarize_equity(blocks)

    alerts = [
        b
        for b in blocks
        if b.get("alert_under_resourced")
        or (
            (b.get("vulnerability_score") or 0) >= 70
            and (b.get("low_income_flag") is True)
            and (b.get("resources_deployed") or 0) < settings.equity_alert_threshold
        )
    ]

    if export_format == "csv":
        header = "block_id,external_id,vulnerability_score,income_median_cad,low_income_flag,resources_deployed,equity_score,alert\n"
        lines = [header]
        for b in blocks:
            lines.append(
                f"{b.get('block_id','')},{b.get('external_id','')},"
                f"{b.get('vulnerability_score','')},{b.get('income_median_cad','')},"
                f"{b.get('low_income_flag','')},{b.get('resources_deployed','')},"
                f"{b.get('equity_score','')},{b.get('alert_under_resourced','')}\n"
            )
        return PlainTextResponse("".join(lines), media_type="text/csv")

    return {
        "city": city,
        "as_of": date.today().isoformat(),
        "summary": summary,
        "alerts": alerts,
        "blocks": blocks,
    }
