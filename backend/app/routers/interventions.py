from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.deps import DbConn
from app.services import scoring

router = APIRouter(prefix="/interventions", tags=["interventions"])


async def _city_id(conn, slug: str) -> UUID:
    row = await conn.fetchrow("SELECT id FROM cities WHERE slug = $1", slug)
    if not row:
        raise HTTPException(status_code=404, detail=f"City not found: {slug}")
    return row["id"]


@router.get("/score")
async def score_interventions(
    conn: DbConn,
    block_id: UUID,
    city: str = Query("toronto"),
) -> dict:
    """Ranked interventions for a block (rule-based; ML optional via watsonx later)."""
    cid = await _city_id(conn, city)
    row = await conn.fetchrow(
        "SELECT id, lst_mean_c, canopy_pct, vulnerability_score FROM blocks WHERE id = $1 AND city_id = $2",
        block_id,
        cid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Block not found")

    pm25 = await conn.fetchval(
        """
        SELECT a.pm25 FROM air_quality_readings a
        CROSS JOIN blocks b
        WHERE b.id = $1 AND b.city_id = $2 AND a.city_id = b.city_id
        ORDER BY ST_Distance(a.location::geography, ST_Centroid(b.geom)::geography) ASC NULLS LAST
        LIMIT 1
        """,
        block_id,
        cid,
    )
    feats = {
        "lst_mean_c": row["lst_mean_c"],
        "canopy_pct": row["canopy_pct"],
        "pm25": pm25,
        "vulnerability_score": row["vulnerability_score"],
    }
    ranked = scoring.intervention_roi_rows(str(block_id), feats)
    return {"block_id": str(block_id), "interventions": ranked, "model": "rules_v1"}
