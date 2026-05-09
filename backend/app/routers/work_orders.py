from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.deps import DbConn
from app.services import scoring

router = APIRouter(prefix="/work-orders", tags=["work-orders"])

INTERVENTION_TO_DEPT_NAME: dict[str, str] = {
    "tree_canopy": "Parks, Forestry and Recreation",
    "cool_roof": "Buildings",
    "permeable_pavement": "Public Works",
}


class WorkOrderCreate(BaseModel):
    block_id: UUID
    intervention_type: Literal["tree_canopy", "cool_roof", "permeable_pavement"]
    notes: str | None = None


class WorkOrderPatch(BaseModel):
    status: Literal["open", "assigned", "in_progress", "resolved"] | None = None
    assigned_to: UUID | None = None
    notes: str | None = None


async def _city_id(conn, slug: str) -> UUID:
    row = await conn.fetchrow("SELECT id FROM cities WHERE slug = $1", slug)
    if not row:
        raise HTTPException(status_code=404, detail=f"City not found: {slug}")
    return row["id"]


@router.post("")
async def create_work_order(
    body: WorkOrderCreate,
    conn: DbConn,
    city: str = Query("toronto"),
) -> dict:
    cid = await _city_id(conn, city)
    block = await conn.fetchrow(
        "SELECT id, lst_mean_c, canopy_pct, vulnerability_score FROM blocks WHERE id = $1 AND city_id = $2",
        body.block_id,
        cid,
    )
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    pm25 = await conn.fetchval(
        """
        SELECT a.pm25 FROM air_quality_readings a
        CROSS JOIN blocks b
        WHERE b.id = $1 AND b.city_id = $2 AND a.city_id = b.city_id
        ORDER BY ST_Distance(a.location::geography, ST_Centroid(b.geom)::geography) ASC NULLS LAST
        LIMIT 1
        """,
        body.block_id,
        cid,
    )
    feats = {
        "lst_mean_c": block["lst_mean_c"],
        "canopy_pct": block["canopy_pct"],
        "pm25": pm25,
        "vulnerability_score": block["vulnerability_score"],
    }
    ranked = scoring.intervention_roi_rows(str(body.block_id), feats)
    chosen = next((r for r in ranked if r["intervention_type"] == body.intervention_type), None)
    if not chosen:
        raise HTTPException(status_code=400, detail="Unknown intervention type")

    dept_name = INTERVENTION_TO_DEPT_NAME[body.intervention_type]
    dept_id = await conn.fetchval(
        "SELECT id FROM departments WHERE city_id = $1 AND name = $2",
        cid,
        dept_name,
    )
    if not dept_id:
        raise HTTPException(status_code=500, detail="Department mapping not seeded")

    iv_id = await conn.fetchval(
        """
        INSERT INTO interventions (block_id, intervention_type, cost_estimate_cad, projected_temp_reduction_c, roi_score)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        """,
        body.block_id,
        body.intervention_type,
        chosen["cost_estimate_cad"],
        chosen["projected_temp_reduction_c"],
        chosen["roi_score"],
    )

    wo_id = await conn.fetchval(
        """
        INSERT INTO work_orders (block_id, intervention_id, status, department_id, notes)
        VALUES ($1, $2, 'open', $3, $4)
        RETURNING id
        """,
        body.block_id,
        iv_id,
        dept_id,
        body.notes,
    )

    return {
        "id": str(wo_id),
        "block_id": str(body.block_id),
        "intervention_id": str(iv_id),
        "department_id": str(dept_id),
        "department_name": dept_name,
        "status": "open",
    }


@router.get("")
async def list_work_orders(
    conn: DbConn,
    city: str = Query("toronto"),
    status: str | None = None,
    department_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> dict:
    cid = await _city_id(conn, city)
    filters: list[str] = ["b.city_id = $1"]
    params: list = [cid]
    idx = 2
    if status:
        filters.append(f"wo.status = ${idx}")
        params.append(status)
        idx += 1
    if department_id:
        filters.append(f"wo.department_id = ${idx}")
        params.append(department_id)
        idx += 1

    where_sql = " AND ".join(filters)
    q = f"""
        SELECT wo.id, wo.status, wo.created_at, wo.updated_at, wo.notes,
               b.external_id AS block_code,
               i.intervention_type,
               d.name AS department_name
        FROM work_orders wo
        JOIN blocks b ON b.id = wo.block_id
        LEFT JOIN interventions i ON i.id = wo.intervention_id
        LEFT JOIN departments d ON d.id = wo.department_id
        WHERE {where_sql}
        ORDER BY wo.created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
    """
    params.extend([limit, offset])
    rows = await conn.fetch(q, *params)
    items = [dict(r) for r in rows]
    for it in items:
        it["id"] = str(it["id"])
    return {"items": items, "limit": limit, "offset": offset}


@router.patch("/{work_order_id}")
async def patch_work_order(
    work_order_id: UUID,
    body: WorkOrderPatch,
    conn: DbConn,
    city: str = Query("toronto"),
) -> dict:
    cid = await _city_id(conn, city)
    exists = await conn.fetchval(
        """
        SELECT wo.id FROM work_orders wo
        JOIN blocks b ON b.id = wo.block_id
        WHERE wo.id = $1 AND b.city_id = $2
        """,
        work_order_id,
        cid,
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Work order not found")

    fields: list[str] = []
    vals: list = []
    n = 1
    if body.status is not None:
        fields.append(f"status = ${n}")
        vals.append(body.status)
        n += 1
    if body.assigned_to is not None:
        fields.append(f"assigned_to = ${n}")
        vals.append(body.assigned_to)
        n += 1
    if body.notes is not None:
        fields.append(f"notes = ${n}")
        vals.append(body.notes)
        n += 1
    if not fields:
        row = await conn.fetchrow("SELECT * FROM work_orders WHERE id = $1", work_order_id)
        return dict(row) if row else {}

    fields.append("updated_at = now()")
    vals.extend([work_order_id])
    sql = f"UPDATE work_orders SET {', '.join(fields)} WHERE id = ${n} RETURNING id, status, updated_at"
    row = await conn.fetchrow(sql, *vals)
    return dict(row) if row else {}
