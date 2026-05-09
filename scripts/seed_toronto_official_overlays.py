#!/usr/bin/env python3
"""
Load official map overlays into ``map_overlays``:

1. **Zoning** — CKAN package ``zoning-by-law``, datastore resource *Zoning Area* (polygons),
   via ``datastore_search`` (same pattern as street trees).
2. **Flood** — local GeoJSON you provide (e.g. TRCA flood plain polygons).

Place flood files under ``scripts/data/``, e.g.::

    scripts/data/Floodline_TRCA_Polygon.geojson

Or pass an absolute path with ``--flood path/to/file.geojson``.

Env overrides (optional):
  TORONTO_CKAN_BASE_URL
  TORONTO_ZONING_BY_LAW_PACKAGE_ID   (default: zoning-by-law)
  TORONTO_ZONING_AREA_RESOURCE_ID    (UUID; otherwise first datastore resource named "Zoning Area")
  TORONTO_FLOOD_GEOJSON              (default path for --flood when used without value)

Rows are tagged with ``properties.source`` so they are not removed by
``scripts/seed_toronto.py`` sample overlay cleanup.

Examples::

    py scripts/seed_toronto_official_overlays.py --zoning
    py scripts/seed_toronto_official_overlays.py --flood scripts/data/Floodline_TRCA_Polygon.geojson
    py scripts/seed_toronto_official_overlays.py --zoning --zoning-limit 500
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DATA = ROOT / "scripts" / "data"

DEFAULT_CKAN_BASE = "https://ckan0.cf.opendata.inter.prod-toronto.ca"
DEFAULT_PACKAGE_ID = "zoning-by-law"
ZONING_RESOURCE_NAME = "Zoning Area"

ZONING_SOURCE = "toronto_ckan_zoning_area"
FLOOD_SOURCE = "trca_floodline_geojson"

FETCH_LIMIT = 32000

USER_AGENT = "CityLens-seed-script/1.0 (Toronto Open Data CKAN consumer)"

INSERT_SQL = """
    INSERT INTO map_overlays (city_id, layer_key, label, geom, properties)
    VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), %s::jsonb)
"""


def _load_dotenv_files() -> None:
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


def ensure_city_slug(cur: psycopg.Cursor, slug: str) -> str:
    cur.execute("SELECT id::text FROM cities WHERE slug = %s", (slug,))
    row = cur.fetchone()
    if not row:
        raise SystemExit(f'City slug "{slug}" not found. Run scripts/seed_toronto.py first.')
    return row[0]


def geometry_to_multipolygon(geom: dict) -> dict:
    t = geom.get("type")
    if t == "Polygon":
        return {"type": "MultiPolygon", "coordinates": [geom["coordinates"]]}
    if t == "MultiPolygon":
        return geom
    raise ValueError(f"Unsupported geometry type for map_overlays: {t}")


def ckan_get(base: str, action: str, params: dict) -> dict:
    q = urllib.parse.urlencode(params)
    url = f"{base.rstrip('/')}/api/3/action/{action}?{q}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise SystemExit(
            f"CKAN HTTP {e.code} for {action}: {e.read().decode('utf-8', errors='replace')[:500]}",
        ) from e
    payload = json.loads(body)
    if not payload.get("success"):
        raise SystemExit(f"CKAN action failed ({action}): {payload}")
    return payload["result"]


def resolve_zoning_area_resource_id(base: str, package_id: str) -> tuple[str, str]:
    override = os.environ.get("TORONTO_ZONING_AREA_RESOURCE_ID", "").strip()
    if override:
        return override, "(TORONTO_ZONING_AREA_RESOURCE_ID)"
    data = ckan_get(base, "package_show", {"id": package_id})
    for rsrc in data.get("resources") or []:
        if rsrc.get("datastore_active") and str(rsrc.get("name") or "") == ZONING_RESOURCE_NAME:
            return str(rsrc["id"]), str(rsrc.get("name") or "")
    raise SystemExit(
        f"No datastore resource named '{ZONING_RESOURCE_NAME}' in package '{package_id}'. "
        "Set TORONTO_ZONING_AREA_RESOURCE_ID to the datastore UUID."
    )


def zoning_row_to_props(rec: dict) -> dict[str, object]:
    out: dict[str, object] = {}
    for k, v in rec.items():
        if k != "geometry":
            out[k] = v
    out["source"] = ZONING_SOURCE
    return out


def zoning_label(props: dict) -> str:
    for key in ("ZN_STRING", "GEN_ZONE", "ZN_ZONE", "HOLDING_ID"):
        v = props.get(key)
        if v not in (None, "", "None"):
            return str(v)[:500]
    return "Zoning"


def ingest_zoning_from_ckan(
    cur: psycopg.Cursor,
    city_id: str,
    *,
    base: str,
    resource_id: str,
    max_rows: int | None,
) -> int:
    offset = 0
    inserted = 0
    total_available: int | None = None

    while True:
        if max_rows is not None and inserted >= max_rows:
            break

        chunk_limit = FETCH_LIMIT
        if max_rows is not None:
            chunk_limit = min(chunk_limit, max_rows - inserted)

        params = urllib.parse.urlencode(
            {"id": resource_id, "limit": str(chunk_limit), "offset": str(offset)},
        )
        url = f"{base.rstrip('/')}/api/3/action/datastore_search?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=300) as resp:
            chunk = json.loads(resp.read().decode("utf-8"))
        if not chunk.get("success"):
            raise SystemExit(f"CKAN datastore_search failed: {chunk}")
        result = chunk.get("result") or {}
        if total_available is None:
            total_available = int(result.get("total") or 0)

        records = result.get("records") or []
        if not records:
            break

        batch: list[tuple] = []
        for rec in records:
            g_raw = rec.get("geometry")
            if isinstance(g_raw, str):
                try:
                    g = json.loads(g_raw)
                except json.JSONDecodeError:
                    continue
            elif isinstance(g_raw, dict):
                g = g_raw
            else:
                continue
            try:
                mp = geometry_to_multipolygon(g)
            except ValueError:
                continue
            props = zoning_row_to_props(rec)
            label = zoning_label(props)
            batch.append(
                ("zoning", label, json.dumps(mp), json.dumps(props)),
            )

        prefixed = [(city_id, lk, lbl, gj, pj) for lk, lbl, gj, pj in batch]
        if prefixed:
            cur.executemany(INSERT_SQL, prefixed)
        inserted += len(batch)
        sys.stdout.write(f"\r  Zoning CKAN offset {offset:,} … inserted {inserted:,} features")
        sys.stdout.flush()

        offset += len(records)
        if total_available is not None and offset >= total_available:
            break
        if len(records) < chunk_limit:
            break

    print()
    return inserted


def load_geojson_file(path: Path) -> dict:
    if not path.is_file():
        raise SystemExit(f"GeoJSON file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def ingest_flood_geojson(cur: psycopg.Cursor, city_id: str, path: Path) -> int:
    data = load_geojson_file(path)
    feats = data.get("features") or []
    batch: list[tuple] = []
    for f in feats:
        geom = f.get("geometry")
        if not geom:
            continue
        try:
            mp = geometry_to_multipolygon(geom)
        except ValueError:
            continue
        props = dict(f.get("properties") or {})
        props["source"] = FLOOD_SOURCE
        label = str(
            props.get("name")
            or props.get("Name")
            or props.get("NAME")
            or props.get("id")
            or props.get("OBJECTID")
            or "Flood hazard",
        )[:500]
        batch.append((city_id, "flood_risk", label, json.dumps(mp), json.dumps(props)))
    if batch:
        cur.executemany(INSERT_SQL, batch)
    return len(batch)


def main() -> int:
    parser = argparse.ArgumentParser(description="Load official zoning (CKAN) and/or flood GeoJSON overlays.")
    parser.add_argument("--city", default=os.environ.get("CITY_SLUG", "toronto"))
    parser.add_argument("--zoning", action="store_true", help="Load Zoning Area from CKAN")
    parser.add_argument(
        "--zoning-limit",
        type=int,
        default=None,
        metavar="N",
        help="Import at most N zoning polygons (testing)",
    )
    parser.add_argument(
        "--flood",
        nargs="?",
        const="__default__",
        default=None,
        metavar="PATH",
        help="Load flood polygons from GeoJSON (default: scripts/data/Floodline_TRCA_Polygon.geojson)",
    )
    args = parser.parse_args()

    if not args.zoning and args.flood is None:
        parser.error("Specify at least one of --zoning or --flood")

    _load_dotenv_files()

    env_flood = os.environ.get("TORONTO_FLOOD_GEOJSON", "").strip()
    if env_flood:
        ep = Path(env_flood)
        default_flood = str((ROOT / ep).resolve() if not ep.is_absolute() else ep.resolve())
    else:
        default_flood = str((SCRIPT_DATA / "Floodline_TRCA_Polygon.geojson").resolve())

    dsn, dsn_err = _resolve_dsn()
    if dsn_err:
        print(dsn_err, file=sys.stderr)
        return 1
    if not dsn:
        print("Missing DATABASE_URL / SUPABASE_DB_URL.", file=sys.stderr)
        return 1

    try:
        timeout_s = int(os.environ.get("SEED_DB_CONNECT_TIMEOUT", os.environ.get("PGCONNECT_TIMEOUT", "60")))
    except ValueError:
        timeout_s = 60
    from app.db_url import psycopg_connect_kwargs_for_pooler  # noqa: PLC0415

    try:
        conn_cm = psycopg.connect(
            dsn,
            connect_timeout=timeout_s,
            **psycopg_connect_kwargs_for_pooler(dsn),
        )
    except psycopg.OperationalError as e:
        print(f"Database connection failed: {e}", file=sys.stderr)
        return 1

    base = os.environ.get("TORONTO_CKAN_BASE_URL", DEFAULT_CKAN_BASE).rstrip("/")
    package_id = os.environ.get("TORONTO_ZONING_BY_LAW_PACKAGE_ID", DEFAULT_PACKAGE_ID).strip()

    with conn_cm as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            city_id = ensure_city_slug(cur, args.city)

            if args.zoning:
                rid, rname = resolve_zoning_area_resource_id(base, package_id)
                print(f"Deleting prior official zoning overlays (source={ZONING_SOURCE})…")
                cur.execute(
                    """
                    DELETE FROM map_overlays
                    WHERE city_id = %s::uuid AND layer_key = 'zoning'
                      AND (properties->>'source') = %s
                    """,
                    (city_id, ZONING_SOURCE),
                )
                print(f"CKAN zoning resource: {rid} ({rname})")
                n_z = ingest_zoning_from_ckan(
                    cur,
                    city_id,
                    base=base,
                    resource_id=rid,
                    max_rows=args.zoning_limit,
                )
            else:
                n_z = 0

            if args.flood is not None:
                flood_path = Path(default_flood if args.flood == "__default__" else args.flood).resolve()
                print(f"Deleting prior TRCA flood overlays (source={FLOOD_SOURCE})…")
                cur.execute(
                    """
                    DELETE FROM map_overlays
                    WHERE city_id = %s::uuid AND layer_key = 'flood_risk'
                      AND (properties->>'source') = %s
                    """,
                    (city_id, FLOOD_SOURCE),
                )
                print(f"Loading flood GeoJSON from {flood_path}…")
                n_f = ingest_flood_geojson(cur, city_id, flood_path)
            else:
                n_f = 0

            conn.commit()

    parts = []
    if args.zoning:
        parts.append(f"zoning={n_z:,}")
    if args.flood is not None:
        parts.append(f"flood={n_f:,}")
    print("Done.", "; ".join(parts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
