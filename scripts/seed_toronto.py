#!/usr/bin/env python3
"""
Seed Toronto neighbourhood polygons from Open Data + mock scores, departments, demographics, sample overlays.
Requires: Postgres URL (DATABASE_URL and/or SUPABASE_* — see README in .env.example), schema applied, psycopg.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]


def _load_dotenv_files() -> None:
    """Pick up DATABASE_URL from .env files when not exported (optional).

    Loads ``backend/.env`` first, then repo ``.env`` with override so the root file
    wins for duplicate keys (avoids stale DATABASE_URL left in backend/.env alone).
    """
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    be = ROOT / "backend" / ".env"
    re = ROOT / ".env"
    if be.is_file():
        load_dotenv(be, override=False)
    if re.is_file():
        load_dotenv(re, override=True)


def _resolve_dsn() -> tuple[str | None, str | None]:
    be = ROOT / "backend"
    if str(be) not in sys.path:
        sys.path.insert(0, str(be))
    from app.db_url import resolve_database_url_from_environ  # noqa: PLC0415

    return resolve_database_url_from_environ(os.environ)


# Official "Neighbourhoods" GeoJSON WGS84 (package refresh ~2025; old dataset UUIDs 404).
# Override with TORONTO_GEOJSON_URL=file:///... or https://... if the portal moves again.
DEFAULT_NEIGHBOURHOODS_URL = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/fc443770-ef0a-4025-9c2c-2cb558bfab00/"
    "resource/0719053b-28b7-48ea-b863-068823a93aaa/download/neighbourhoods-4326.geojson"
)


def _prop(props: dict, *keys: str) -> object:
    """First non-empty property, trying exact keys."""
    for k in keys:
        if k in props and props[k] not in (None, ""):
            return props[k]
    lower = {str(k).lower(): v for k, v in props.items()}
    for k in keys:
        lk = k.lower()
        if lk in lower and lower[lk] not in (None, ""):
            return lower[lk]
    return None


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
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "CityLens-seed-script/1.0 (Toronto Open Data consumer)"},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise SystemExit(
                f"HTTP {e.code} loading GeoJSON ({url}). "
                "Set TORONTO_GEOJSON_URL to the current \"Neighbourhoods - 4326.geojson\" "
                "download link from https://open.toronto.ca/dataset/neighbourhoods/"
            ) from e
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
            _prop(props, "_id", "AREA_SHORT_CODE", "NEIGHBOURHOOD_NUMBER", "OBJECTID", "FID", "id")
            or idx
        )
        name = str(_prop(props, "AREA_NAME", "NAME", "name", "NEIGHBOURHOOD") or f"Area {ext}")
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
    _load_dotenv_files()
    dsn, dsn_err = _resolve_dsn()
    if dsn_err:
        print(dsn_err, file=sys.stderr)
        return 1
    if not dsn:
        print(
            "Missing database URL. Set DATABASE_URL / SUPABASE_DB_URL, "
            'or SUPABASE_URL=http://127.0.0.1:54321 plus `supabase start` defaults on port 54322.\n'
            "Install python-dotenv (pip install -r backend/requirements.txt) to load .env files.",
            file=sys.stderr,
        )
        return 1

    source = os.environ.get("TORONTO_GEOJSON_URL", DEFAULT_NEIGHBOURHOODS_URL)
    print(f"Loading polygons from {source[:80]}…")

    data = load_geojson(source)

    try:
        try:
            timeout_s = int(
                os.environ.get("SEED_DB_CONNECT_TIMEOUT", os.environ.get("PGCONNECT_TIMEOUT", "60")),
            )
        except ValueError:
            timeout_s = 60
        conn_cm = psycopg.connect(dsn, connect_timeout=timeout_s)
    except psycopg.OperationalError as e:
        msg_l = str(e).lower()
        print("Database connection failed.", file=sys.stderr)
        print(f"  Details: {e}", file=sys.stderr)
        if "timeout" in msg_l or "timed out" in msg_l:
            print(
                "  Supabase \"Direct connection\" often uses IPv6. On IPv4-only networks it can time out.",
                file=sys.stderr,
            )
            print(
                '  Fix: In the Supabase "Connect" dialog, copy the Session pooler URI (IPv4-compatible), '
                "set that as DATABASE_URL, URL-encode any special characters in the password, and add "
                "`?sslmode=require` if not present.",
                file=sys.stderr,
            )
            print(
                "  Or enable the paid IPv4 add-on. You can also try SEED_DB_CONNECT_TIMEOUT=120 (seconds).",
                file=sys.stderr,
            )
        if "password authentication failed" in msg_l:
            print(
                "  Use the Database password from Supabase (Settings → Database), not the anon/service API keys.",
                file=sys.stderr,
            )
            print(
                "  In DATABASE_URL special characters must be percent-encoded "
                '(e.g. < → %3C, # → %23, % → %25). If you edited only .env but not backend/.env, '
                "this script now prefers the repo-root .env for duplicate DATABASE_URL.",
                file=sys.stderr,
            )
        if "ssl" in msg_l:
            print("  Append ?sslmode=require to DATABASE_URL when connecting off-platform.", file=sys.stderr)
        raise SystemExit(1) from e

    with conn_cm as conn:
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
