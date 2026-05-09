from __future__ import annotations

import json
from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.deps import DbConn
from app.services import nasa_firms, openaq, scoring, sentinel_hub
from app.services.nasa_firms import parse_firms_datetime

router = APIRouter(prefix="/ingest", tags=["ingest"])


async def _city_id(conn, slug: str) -> UUID:
    row = await conn.fetchrow("SELECT id FROM cities WHERE slug = $1", slug)
    if not row:
        raise HTTPException(status_code=404, detail=f"City not found: {slug}")
    return row["id"]


def _toronto_bbox_tuple() -> tuple[float, float, float, float]:
    min_lon, min_lat, max_lon, max_lat = (float(x) for x in settings.toronto_bbox.split(","))
    return min_lon, min_lat, max_lon, max_lat


def _in_bbox(lon: float, lat: float, bbox: tuple[float, float, float, float]) -> bool:
    min_lon, min_lat, max_lon, max_lat = bbox
    return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat


@router.post("/openaq")
async def ingest_openaq(conn: DbConn, city: str = Query("toronto")) -> dict:
    cid = await _city_id(conn, city)
    locs = await openaq.fetch_latest_locations()
    inserted = 0
    for loc in locs:
        await conn.execute(
            """
            INSERT INTO air_quality_readings (city_id, observed_at, location, pm25, pm10, raw)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7::jsonb)
            """,
            cid,
            loc["datetime"],
            loc["lon"],
            loc["lat"],
            loc["pm25"],
            loc["pm10"],
            json.dumps(loc["raw"]),
        )
        inserted += 1
    return {"inserted": inserted}


@router.post("/firms")
async def ingest_firms(conn: DbConn, city: str = Query("toronto"), days: int = Query(1, ge=1, le=5)) -> dict:
    cid = await _city_id(conn, city)
    bbox = _toronto_bbox_tuple()
    rows = await nasa_firms.fetch_modis_hotspots_csv(days=days)
    inserted = 0
    for row in rows:
        if not _in_bbox(row["lon"], row["lat"], bbox):
            continue
        ts = parse_firms_datetime(row)
        await conn.execute(
            """
            INSERT INTO firms_hotspots (city_id, observed_at, geom, brightness, scan, track, raw)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8::jsonb)
            """,
            cid,
            ts,
            row["lon"],
            row["lat"],
            row["brightness"],
            row["scan"],
            row["track"],
            json.dumps(row["raw"]),
        )
        inserted += 1
    return {"inserted": inserted, "candidates": len(rows)}


@router.post("/sentinel_zonal")
async def ingest_sentinel_zonal(conn: DbConn, city: str = Query("toronto")) -> dict:
    """
    Placeholder: assigns a stub LST to blocks when Hub returns catalog hits.
    Replace with Process API zonal stats per block for production.
    """
    cid = await _city_id(conn, city)
    bbox = _toronto_bbox_tuple()
    lst = await sentinel_hub.estimate_lst_placeholder(bbox)
    if lst is None:
        return {"updated_blocks": 0, "message": "Sentinel Hub not configured or no coverage"}

    observed = date.today()
    blocks = await conn.fetch("SELECT id FROM blocks WHERE city_id = $1", cid)
    n = 0
    for b in blocks:
        await conn.execute(
            """
            INSERT INTO block_thermal_snapshots (block_id, observed_at, lst_mean_c, source, meta)
            VALUES ($1, $2, $3, 'sentinel_hub_stub', '{}'::jsonb)
            ON CONFLICT (block_id, observed_at, source) DO UPDATE SET lst_mean_c = EXCLUDED.lst_mean_c
            """,
            b["id"],
            observed,
            lst,
        )
        await conn.execute(
            "UPDATE blocks SET lst_mean_c = $2 WHERE id = $1",
            b["id"],
            lst,
        )
        pm25 = await conn.fetchval(
            """
            SELECT a.pm25 FROM air_quality_readings a
            CROSS JOIN blocks bl
            WHERE bl.id = $1 AND a.city_id = bl.city_id
            ORDER BY ST_Distance(a.location::geography, ST_Centroid(bl.geom)::geography) ASC NULLS LAST
            LIMIT 1
            """,
            b["id"],
        )
        score = scoring.rule_based_vulnerability(
            {"lst_mean_c": lst, "canopy_pct": None, "pm25": pm25},
        )
        await conn.execute(
            "UPDATE blocks SET vulnerability_score = $2, scoring_model_version = $3 WHERE id = $1",
            b["id"],
            score,
            "sentinel_stub_v1",
        )
        n += 1
    return {"updated_blocks": n, "lst_mean_c": lst}


@router.post("/equity_snapshot")
async def ingest_equity_snapshot(conn: DbConn, city: str = Query("toronto")) -> dict:
    """Recompute equity snapshots + alerts from interventions deployed per block."""
    cid = await _city_id(conn, city)
    rows = await conn.fetch(
        """
        SELECT b.id,
               b.vulnerability_score,
               d.low_income_flag,
               d.income_median_cad,
               (SELECT COUNT(*)::int FROM interventions i WHERE i.block_id = b.id) AS intervention_count
        FROM blocks b
        LEFT JOIN demographics d ON d.block_id = b.id AND d.census_year = (
            SELECT MAX(census_year) FROM demographics d2 WHERE d2.block_id = b.id
        )
        WHERE b.city_id = $1
        """,
        cid,
    )

    inserted = 0
    snap_date = date.today()
    for r in rows:
        deployed = min(1.0, float(r["intervention_count"]) / 3.0)
        vuln = float(r["vulnerability_score"] or 0)
        income_med = r["income_median_cad"]
        low = bool(r["low_income_flag"])
        equity_score = None
        if income_med:
            equity_score = max(0.0, min(1.0, deployed / max(vuln / 100.0, 0.01)))

        alert = (
            low
            and vuln >= 65
            and deployed < settings.equity_alert_threshold
        )

        await conn.execute(
            """
            INSERT INTO equity_snapshots (
              city_id, snapshot_date, block_id, resources_deployed, equity_score,
              vulnerability_percentile, income_percentile, alert_under_resourced, meta
            )
            VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6, '{}'::jsonb)
            """,
            cid,
            snap_date,
            r["id"],
            deployed,
            equity_score,
            alert,
        )
        inserted += 1

    return {"snapshots_written": inserted, "date": snap_date.isoformat()}
