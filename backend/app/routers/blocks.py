from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.deps import DbConn
from app.pg_json import decode_pg_json
from app.services import scoring
from app.services.featherless import score_block_featherless
from app.services.watsonx import score_block_ml

router = APIRouter(prefix="/blocks", tags=["blocks"])


async def _city_id(conn, slug: str) -> UUID:
    row = await conn.fetchrow("SELECT id FROM cities WHERE slug = $1", slug)
    if not row:
        raise HTTPException(status_code=404, detail=f"City not found: {slug}")
    return row["id"]


@router.get("/geojson")
async def blocks_geojson(
    conn: DbConn,
    city: str = Query("toronto"),
    min_lon: float | None = None,
    min_lat: float | None = None,
    max_lon: float | None = None,
    max_lat: float | None = None,
    limit: int = Query(5000, ge=1, le=20000),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """GeoJSON FeatureCollection for choropleth rendering."""
    cid = await _city_id(conn, city)
    use_bbox = (
        min_lon is not None and min_lat is not None and max_lon is not None and max_lat is not None
    )

    if use_bbox:
        rows = await conn.fetch(
            """
            SELECT b.id, b.name, b.external_id, b.vulnerability_score, b.lst_mean_c, b.canopy_pct,
                   ST_AsGeoJSON(b.geom)::json AS geom
            FROM blocks b
            WHERE b.city_id = $1
              AND ST_Intersects(b.geom, ST_MakeEnvelope($2, $3, $4, $5, 4326))
            ORDER BY b.external_id
            LIMIT $6 OFFSET $7
            """,
            cid,
            min_lon,
            min_lat,
            max_lon,
            max_lat,
            limit,
            offset,
        )
    else:
        rows = await conn.fetch(
            """
            SELECT b.id, b.name, b.external_id, b.vulnerability_score, b.lst_mean_c, b.canopy_pct,
                   ST_AsGeoJSON(b.geom)::json AS geom
            FROM blocks b
            WHERE b.city_id = $1
            ORDER BY b.external_id
            LIMIT $2 OFFSET $3
            """,
            cid,
            limit,
            offset,
        )

    features: list[dict[str, Any]] = []
    for r in rows:
        features.append(
            {
                "type": "Feature",
                "id": str(r["id"]),
                "geometry": decode_pg_json(r["geom"]),
                "properties": {
                    "name": r["name"],
                    "external_id": r["external_id"],
                    "vulnerability_score": r["vulnerability_score"],
                    "lst_mean_c": r["lst_mean_c"],
                    "canopy_pct": r["canopy_pct"],
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


@router.get("")
async def list_blocks(
    conn: DbConn,
    city: str = Query("toronto"),
    min_lon: float | None = None,
    min_lat: float | None = None,
    max_lon: float | None = None,
    max_lat: float | None = None,
    limit: int = Query(100, ge=1, le=5000),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """Paginated block summaries (non-GeoJSON)."""
    cid = await _city_id(conn, city)
    use_bbox = (
        min_lon is not None and min_lat is not None and max_lon is not None and max_lat is not None
    )
    if use_bbox:
        rows = await conn.fetch(
            """
            SELECT b.id, b.name, b.external_id, b.vulnerability_score, b.lst_mean_c, b.canopy_pct,
                   ST_Y(ST_Centroid(b.geom))::double precision AS lat,
                   ST_X(ST_Centroid(b.geom))::double precision AS lng,
                   demo.low_income_flag, demo.population,
                   aq.pm25,
                   EXISTS (
                       SELECT 1 FROM map_overlays mo
                       WHERE mo.city_id = b.city_id
                         AND mo.layer_key = 'flood_risk'
                         AND ST_Intersects(b.geom, mo.geom)
                   ) AS flood_overlay_hit,
                   (
                       SELECT MIN(ST_Distance(ST_Centroid(b.geom)::geography, ST_Boundary(mo.geom)::geography))
                       FROM map_overlays mo
                       WHERE mo.city_id = b.city_id
                         AND mo.layer_key = 'flood_risk'
                   ) AS flood_edge_m
            FROM blocks b
            LEFT JOIN LATERAL (
              SELECT d.low_income_flag, d.population
              FROM demographics d
              WHERE d.block_id = b.id
              ORDER BY d.census_year DESC
              LIMIT 1
            ) demo ON true
            LEFT JOIN LATERAL (
              SELECT a.pm25
              FROM air_quality_readings a
              WHERE a.city_id = b.city_id
              ORDER BY ST_Distance(a.location::geography, ST_Centroid(b.geom)::geography) ASC NULLS LAST
              LIMIT 1
            ) aq ON true
            WHERE b.city_id = $1
              AND ST_Intersects(b.geom, ST_MakeEnvelope($2, $3, $4, $5, 4326))
            ORDER BY b.external_id
            LIMIT $6 OFFSET $7
            """,
            cid,
            min_lon,
            min_lat,
            max_lon,
            max_lat,
            limit,
            offset,
        )
        total = await conn.fetchval(
            """
            SELECT COUNT(*) FROM blocks b
            WHERE b.city_id = $1
              AND ST_Intersects(b.geom, ST_MakeEnvelope($2, $3, $4, $5, 4326))
            """,
            cid,
            min_lon,
            min_lat,
            max_lon,
            max_lat,
        )
    else:
        rows = await conn.fetch(
            """
            SELECT b.id, b.name, b.external_id, b.vulnerability_score, b.lst_mean_c, b.canopy_pct,
                   ST_Y(ST_Centroid(b.geom))::double precision AS lat,
                   ST_X(ST_Centroid(b.geom))::double precision AS lng,
                   demo.low_income_flag, demo.population,
                   aq.pm25,
                   EXISTS (
                       SELECT 1 FROM map_overlays mo
                       WHERE mo.city_id = b.city_id
                         AND mo.layer_key = 'flood_risk'
                         AND ST_Intersects(b.geom, mo.geom)
                   ) AS flood_overlay_hit,
                   (
                       SELECT MIN(ST_Distance(ST_Centroid(b.geom)::geography, ST_Boundary(mo.geom)::geography))
                       FROM map_overlays mo
                       WHERE mo.city_id = b.city_id
                         AND mo.layer_key = 'flood_risk'
                   ) AS flood_edge_m
            FROM blocks b
            LEFT JOIN LATERAL (
              SELECT d.low_income_flag, d.population
              FROM demographics d
              WHERE d.block_id = b.id
              ORDER BY d.census_year DESC
              LIMIT 1
            ) demo ON true
            LEFT JOIN LATERAL (
              SELECT a.pm25
              FROM air_quality_readings a
              WHERE a.city_id = b.city_id
              ORDER BY ST_Distance(a.location::geography, ST_Centroid(b.geom)::geography) ASC NULLS LAST
              LIMIT 1
            ) aq ON true
            WHERE b.city_id = $1
            ORDER BY b.external_id
            LIMIT $2 OFFSET $3
            """,
            cid,
            limit,
            offset,
        )
        total = await conn.fetchval("SELECT COUNT(*) FROM blocks WHERE city_id = $1", cid)

    items = [dict(r) for r in rows]
    for i in items:
        i["id"] = str(i["id"])
    return {"city": city, "total": int(total or 0), "limit": limit, "offset": offset, "items": items}


@router.get("/{block_id}")
async def get_block(conn: DbConn, block_id: UUID, city: str = Query("toronto")) -> dict[str, Any]:
    cid = await _city_id(conn, city)
    row = await conn.fetchrow(
        """
        SELECT b.*, ST_AsGeoJSON(b.geom)::json AS geom_json,
               ST_Y(ST_Centroid(b.geom))::double precision AS lat,
               ST_X(ST_Centroid(b.geom))::double precision AS lng,
               EXISTS (
                   SELECT 1 FROM map_overlays mo
                   WHERE mo.city_id = b.city_id
                     AND mo.layer_key = 'flood_risk'
                     AND ST_Intersects(b.geom, mo.geom)
               ) AS flood_overlay_hit,
               (
                   SELECT MIN(ST_Distance(ST_Centroid(b.geom)::geography, ST_Boundary(mo.geom)::geography))
                   FROM map_overlays mo
                   WHERE mo.city_id = b.city_id
                     AND mo.layer_key = 'flood_risk'
               ) AS flood_edge_m
        FROM blocks b
        WHERE b.id = $1 AND b.city_id = $2
        """,
        block_id,
        cid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Block not found")

    props = {
        "id": str(row["id"]),
        "name": row["name"],
        "external_id": row["external_id"],
        "vulnerability_score": row["vulnerability_score"],
        "lst_mean_c": row["lst_mean_c"],
        "canopy_pct": row["canopy_pct"],
        "population": row.get("population"),
        "geometry": decode_pg_json(row["geom_json"]),
        "lat": row["lat"],
        "lng": row["lng"],
    }

    pm25 = await conn.fetchval(
        """
        SELECT a.pm25
        FROM air_quality_readings a
        CROSS JOIN blocks b
        WHERE b.id = $1 AND b.city_id = $2 AND a.city_id = b.city_id
        ORDER BY ST_Distance(a.location::geography, ST_Centroid(b.geom)::geography) ASC NULLS LAST
        LIMIT 1
        """,
        block_id,
        cid,
    )
    props["pm25"] = pm25
    props["flood_overlay_hit"] = bool(row["flood_overlay_hit"])
    fe = row["flood_edge_m"]
    props["flood_edge_m"] = float(fe) if fe is not None else None

    block_for_score = {
        "lst_mean_c": row["lst_mean_c"],
        "canopy_pct": row["canopy_pct"],
        "pm25": pm25,
        "vulnerability_score": row["vulnerability_score"],
    }

    ml = await score_block_featherless({"block_id": str(block_id), **block_for_score})
    
    if ml:
        props["ml_scoring"] = ml

    iv_rows = await conn.fetch(
        """
        SELECT intervention_type, cost_estimate_cad, projected_temp_reduction_c, roi_score
        FROM interventions WHERE block_id = $1 ORDER BY roi_score DESC
        """,
        block_id,
    )
    interventions = [dict(r) for r in iv_rows]
    if not interventions:
        interventions = scoring.intervention_roi_rows(str(block_id), block_for_score)

    wo = await conn.fetch(
        """
        SELECT wo.id, wo.status, wo.created_at, wo.updated_at,
               i.intervention_type, d.name AS department_name
        FROM work_orders wo
        LEFT JOIN interventions i ON i.id = wo.intervention_id
        LEFT JOIN departments d ON d.id = wo.department_id
        WHERE wo.block_id = $1
        ORDER BY wo.created_at DESC
        """,
        block_id,
    )
    work_orders = [dict(r) for r in wo]
    for w in work_orders:
        w["id"] = str(w["id"])

    props["interventions"] = interventions
    props["work_orders"] = work_orders
    return props


@router.post("/{block_id}/rescore")
async def rescore_block(conn: DbConn, block_id: UUID, city: str = Query("toronto")) -> dict[str, Any]:
    """Recompute vulnerability_score from attributes (rule-based)."""
    cid = await _city_id(conn, city)
    row = await conn.fetchrow(
        "SELECT lst_mean_c, canopy_pct, vulnerability_score FROM blocks WHERE id = $1 AND city_id = $2",
        block_id,
        cid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Block not found")

    pm25 = await conn.fetchval(
        """
        SELECT a.pm25
        FROM air_quality_readings a
        CROSS JOIN blocks b
        WHERE b.id = $1 AND b.city_id = $2 AND a.city_id = b.city_id
        ORDER BY ST_Distance(a.location::geography, ST_Centroid(b.geom)::geography) ASC NULLS LAST
        LIMIT 1
        """,
        block_id,
        cid,
    )
    block_for_score = {
        "lst_mean_c": row["lst_mean_c"],
        "canopy_pct": row["canopy_pct"],
        "pm25": pm25,
    }
    score = scoring.rule_based_vulnerability(block_for_score)
    await conn.execute(
        "UPDATE blocks SET vulnerability_score = $2, scoring_model_version = $3 WHERE id = $1",
        block_id,
        score,
        "rules_v1",
    )
    return {"block_id": str(block_id), "vulnerability_score": score, "model": "rules_v1"}
