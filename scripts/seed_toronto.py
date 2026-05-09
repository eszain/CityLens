#!/usr/bin/env python3
"""
Seed Toronto neighbourhood polygons from Open Data + mock scores, departments, demographics, sample overlays.
Requires: DATABASE_URL, schema applied (supabase/migrations), psycopg (backend venv).
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.request
from pathlib import Path

import psycopg

NEIGHBOURHOODS_URL = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/8405af37-43f9-429e-a677-d04288155821/"
    "resource/98915fa6-760e-45da-a187-f351e1868976/download/neighbourhoods-4326.geojson"
)

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DATA = ROOT / "scripts" / "sample-data"


def _stable_float(seed: str, lo: float, hi: float) -> float:
    h = hashlib.sha256(seed.encode()).hexdigest()
    v = int(h[:8], 16) / 0xFFFFFFFF
    return lo + (hi - lo) * v


def ensure_city(cur: psycopg.Cursor) -> str:
    cur.execute(
        """
        INSERT INTO cities (slug, name, config)
        VALUES ('toronto', 'Toronto', '{"country":"CA","tz":"America/Toronto"}'::jsonb)
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
        RETURNING id::text
        """
    )
    row = cur.fetchone()
    assert row
    return row[0]


def load_geojson(url: str) -> dict:
    if url.startswith("http"):
        with urllib.request.urlopen(url, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    path = Path(url)
    return json.loads(path.read_text(encoding="utf-8"))


def geometry_to_multipolygon(geom: dict) -> dict:
    if geom["type"] == "Polygon":
        return {"type": "MultiPolygon", "coordinates": [geom["coordinates"]]}
    return geom


def seed_blocks(cur: psycopg.Cursor, city_id: str, data: dict) -> int:
    feats = data.get("features") or []
    n = 0
    for idx, f in enumerate(feats):
        geom = f.get("geometry")
        if not geom:
            continue
        props = f.get("properties") or {}
        ext = str(
            props.get("AREA_SHORT_CODE")
            or props.get("NEIGHBOURHOOD_NUMBER")
            or props.get("OBJECTID")
            or props.get("FID")
            or idx
        )
        name = str(props.get("AREA_NAME") or props.get("NAME") or f"Area {ext}")
        geom = geometry_to_multipolygon(geom)
        gj = json.dumps(geom)
        seed = f"{ext}:{name}"
        vuln = round(_stable_float(seed + ":v", 15, 95), 2)
        canopy = round(_stable_float(seed + ":c", 5, 55), 2)
        lst = round(_stable_float(seed + ":t", 24, 34), 2)

        cur.execute(
            """
            INSERT INTO blocks (city_id, external_id, name, geom, vulnerability_score, canopy_pct, lst_mean_c, scoring_model_version)
            VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), %s, %s, %s, 'seed_mock_v1')
            ON CONFLICT (city_id, external_id) DO UPDATE SET
              name = EXCLUDED.name,
              geom = EXCLUDED.geom,
              vulnerability_score = EXCLUDED.vulnerability_score,
              canopy_pct = EXCLUDED.canopy_pct,
              lst_mean_c = EXCLUDED.lst_mean_c
            """,
            (city_id, ext, name, gj, vuln, canopy, lst),
        )

        cur.execute("SELECT id FROM blocks WHERE city_id = %s AND external_id = %s", (city_id, ext))
        bid = cur.fetchone()[0]
        income = int(_stable_float(seed + ":i", 35000, 120000))
        low = income < 55000
        cur.execute(
            """
            INSERT INTO demographics (block_id, census_year, income_median_cad, income_bracket, population, low_income_flag)
            VALUES (%s, 2021, %s, %s, %s, %s)
            ON CONFLICT (block_id, census_year) DO UPDATE SET
              income_median_cad = EXCLUDED.income_median_cad,
              income_bracket = EXCLUDED.income_bracket,
              population = EXCLUDED.population,
              low_income_flag = EXCLUDED.low_income_flag
            """,
            (
                bid,
                income,
                "low" if low else "mid",
                int(_stable_float(seed + ":p", 1200, 25000)),
                low,
            ),
        )
        n += 1
    return n


def seed_departments(cur: psycopg.Cursor, city_id: str) -> None:
    rows: list[tuple[str, list[str]]] = [
        ("Parks, Forestry and Recreation", ["tree_canopy"]),
        ("Buildings", ["cool_roof"]),
        ("Public Works", ["permeable_pavement"]),
    ]
    for name, types in rows:
        cur.execute(
            """
            INSERT INTO departments (city_id, name, intervention_types)
            VALUES (%s, %s, %s::text[])
            ON CONFLICT (city_id, name) DO NOTHING
            """,
            (city_id, name, types),
        )


def seed_sample_overlays(cur: psycopg.Cursor, city_id: str) -> int:
    if not SAMPLE_DATA.exists():
        return 0
    cur.execute(
        """
        DELETE FROM map_overlays
        WHERE city_id = %s AND layer_key IN ('canopy', 'zoning', 'flood_risk')
        """,
        (city_id,),
    )
    inserted = 0
    mapping = [
        ("canopy_sample.geojson", "canopy", "Sample canopy"),
        ("zoning_sample.geojson", "zoning", "Sample zoning"),
        ("flood_risk_sample.geojson", "flood_risk", "Sample flood risk"),
    ]
    for fname, key, label in mapping:
        fp = SAMPLE_DATA / fname
        if not fp.exists():
            continue
        data = json.loads(fp.read_text(encoding="utf-8"))
        for f in data.get("features", []):
            geom = f.get("geometry")
            if not geom:
                continue
            geom = geometry_to_multipolygon(geom)
            props = f.get("properties") or {}
            cur.execute(
                """
                INSERT INTO map_overlays (city_id, layer_key, label, geom, properties)
                VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), %s::jsonb)
                """,
                (city_id, key, props.get("label") or label, json.dumps(geom), json.dumps(props)),
            )
            inserted += 1
    return inserted


def main() -> int:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL is required", file=sys.stderr)
        return 1

    source = os.environ.get("TORONTO_GEOJSON_URL", NEIGHBOURHOODS_URL)
    print(f"Loading polygons from {source[:80]}…")

    data = load_geojson(source)

    with psycopg.connect(dsn) as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            city_id = ensure_city(cur)
            seed_departments(cur, city_id)
            n = seed_blocks(cur, city_id, data)
            m = seed_sample_overlays(cur, city_id)
            conn.commit()
    print(f"Seeded {n} blocks; sample overlays inserted: {m}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
