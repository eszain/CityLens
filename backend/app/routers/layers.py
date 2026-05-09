from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.deps import DbConn
from app.pg_json import as_geojson_properties, decode_pg_json

router = APIRouter(prefix="/layers", tags=["layers"])


async def _city_id(conn, slug: str):
    row = await conn.fetchrow("SELECT id FROM cities WHERE slug = $1", slug)
    if not row:
        raise HTTPException(status_code=404, detail=f"City not found: {slug}")
    return row["id"]


@router.get("/overlays/geojson")
async def overlays_geojson(
    conn: DbConn,
    city: str = Query("toronto"),
    layers: str = Query("canopy,zoning,flood_risk", description="Comma-separated layer keys"),
) -> dict[str, Any]:
    keys = [k.strip() for k in layers.split(",") if k.strip()]
    cid = await _city_id(conn, city)
    rows = await conn.fetch(
        """
        SELECT id, layer_key, label, properties, ST_AsGeoJSON(geom)::json AS geom
        FROM map_overlays
        WHERE city_id = $1 AND layer_key = ANY($2::text[])
        """,
        cid,
        keys,
    )
    features: list[dict[str, Any]] = []
    for r in rows:
        base = as_geojson_properties(r["properties"])
        features.append(
            {
                "type": "Feature",
                "id": str(r["id"]),
                "geometry": decode_pg_json(r["geom"]),
                "properties": {
                    "layer_key": r["layer_key"],
                    "label": r["label"],
                    **base,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


@router.get("/firms/geojson")
async def firms_geojson(
    conn: DbConn,
    city: str = Query("toronto"),
    limit: int = Query(500, ge=1, le=5000),
) -> dict[str, Any]:
    cid = await _city_id(conn, city)
    rows = await conn.fetch(
        """
        SELECT id, brightness, observed_at, ST_AsGeoJSON(geom)::json AS geom
        FROM firms_hotspots
        WHERE city_id = $1
        ORDER BY observed_at DESC
        LIMIT $2
        """,
        cid,
        limit,
    )
    features: list[dict[str, Any]] = []
    for r in rows:
        features.append(
            {
                "type": "Feature",
                "id": str(r["id"]),
                "geometry": decode_pg_json(r["geom"]),
                "properties": {"brightness": r["brightness"], "observed_at": r["observed_at"].isoformat()},
            }
        )
    return {"type": "FeatureCollection", "features": features}


@router.get("/air_quality/geojson")
async def air_geojson(
    conn: DbConn,
    city: str = Query("toronto"),
    limit: int = Query(500, ge=1, le=5000),
) -> dict[str, Any]:
    cid = await _city_id(conn, city)
    rows = await conn.fetch(
        """
        SELECT id, pm25, pm10, observed_at, ST_AsGeoJSON(location)::json AS geom
        FROM air_quality_readings
        WHERE city_id = $1
        ORDER BY observed_at DESC
        LIMIT $2
        """,
        cid,
        limit,
    )
    features: list[dict[str, Any]] = []
    for r in rows:
        features.append(
            {
                "type": "Feature",
                "id": str(r["id"]),
                "geometry": decode_pg_json(r["geom"]),
                "properties": {
                    "pm25": r["pm25"],
                    "pm10": r["pm10"],
                    "observed_at": r["observed_at"].isoformat(),
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}
