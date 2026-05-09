#!/usr/bin/env python3
"""
Load Toronto street tree inventory from CKAN into ``street_trees``.

Uses the documented Toronto Open Data CKAN endpoints (package_show +
datastore_search). Not a scrape of HTML.

Env (optional overrides if the portal changes):
  TORONTO_CKAN_BASE_URL   default https://ckan0.cf.opendata.inter.prod-toronto.ca
  TORONTO_STREET_TREES_PACKAGE_ID   default street-tree-data
  TORONTO_STREET_TREES_RESOURCE_ID  datastore resource UUID (otherwise first datastore-active resource)

One-off limits for dev:
  python scripts/seed_toronto_street_trees.py --limit 5000

Requires: Postgres with migration ``20250509120000_street_trees.sql`` applied,
same DATABASE_URL resolution as scripts/seed_toronto.py (root / backend .env).
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

DEFAULT_CKAN_BASE = "https://ckan0.cf.opendata.inter.prod-toronto.ca"
DEFAULT_PACKAGE_ID = "street-tree-data"

USER_AGENT = "CityLens-seed-script/1.0 (Toronto Open Data CKAN consumer)"
FETCH_LIMIT = 32000


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


def ensure_city_slug(cur: psycopg.Cursor, slug: str = "toronto") -> str:
    cur.execute("SELECT id::text FROM cities WHERE slug = %s", (slug,))
    row = cur.fetchone()
    if not row:
        raise SystemExit(
            f'City slug "{slug}" not found. Run scripts/seed_toronto.py first to create the city and blocks.'
        )
    return row[0]


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


def resolve_datastore_resource_id(base: str, package_id: str) -> tuple[str, str]:
    """Return (resource_id, human name)."""
    data = ckan_get(base, "package_show", {"id": package_id})
    for rsrc in data.get("resources") or []:
        if rsrc.get("datastore_active"):
            return str(rsrc["id"]), str(rsrc.get("name") or "")
    raise SystemExit(
        f"No datastore_active resource in package '{package_id}'. "
        "Set TORONTO_STREET_TREES_RESOURCE_ID to the correct resource UUID."
    )


def parse_point(geometry_field: object) -> tuple[float, float] | None:
    if geometry_field is None:
        return None
    try:
        if isinstance(geometry_field, str):
            g = json.loads(geometry_field)
        elif isinstance(geometry_field, dict):
            g = geometry_field
        else:
            return None
        if g.get("type") != "Point":
            return None
        coords = g.get("coordinates")
        if not coords or len(coords) < 2:
            return None
        lon, lat = float(coords[0]), float(coords[1])
        return lon, lat
    except (TypeError, ValueError, json.JSONDecodeError):
        return None


def _scalar_str(v: object) -> str | None:
    if v is None or v == "" or v == "None":
        return None
    return str(v)


def _scalar_float(v: object) -> float | None:
    if v is None or v == "" or v == "None":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _scalar_int(v: object) -> int | None:
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def row_to_tuple(city_id: str, rec: dict) -> tuple | None:
    struct = _scalar_str(rec.get("STRUCTID"))
    if not struct:
        return None
    pt = parse_point(rec.get("geometry"))
    if not pt:
        return None
    lon, lat = pt
    raw = {k: v for k, v in rec.items() if k != "geometry"}
    return (
        city_id,
        struct,
        lon,
        lat,
        _scalar_int(rec.get("OBJECTID")),
        _scalar_str(rec.get("ADDRESS")),
        _scalar_str(rec.get("STREETNAME")),
        _scalar_str(rec.get("WARD")),
        _scalar_str(rec.get("BOTANICAL_NAME")),
        _scalar_str(rec.get("COMMON_NAME")),
        _scalar_float(rec.get("DBH_TRUNK")),
        json.dumps(raw),
    )


def ingest_street_trees(
    cur: psycopg.Cursor,
    city_id: str,
    *,
    base: str,
    resource_id: str,
    max_rows: int | None,
) -> int:
    insert_sql = """
        INSERT INTO street_trees (
          city_id, struct_id, geom, object_id, address, street_name, ward,
          botanical_name, common_name, dbh_trunk_cm, raw
        )
        VALUES (
          %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326),
          %s, %s, %s, %s, %s, %s, %s, %s::jsonb
        )
        ON CONFLICT (city_id, struct_id) DO UPDATE SET
          geom = EXCLUDED.geom,
          object_id = EXCLUDED.object_id,
          address = EXCLUDED.address,
          street_name = EXCLUDED.street_name,
          ward = EXCLUDED.ward,
          botanical_name = EXCLUDED.botanical_name,
          common_name = EXCLUDED.common_name,
          dbh_trunk_cm = EXCLUDED.dbh_trunk_cm,
          raw = EXCLUDED.raw
    """

    offset = 0
    total_inserted = 0
    total_available: int | None = None

    while True:
        if max_rows is not None and total_inserted >= max_rows:
            break
        chunk_limit = FETCH_LIMIT
        if max_rows is not None:
            chunk_limit = min(chunk_limit, max_rows - total_inserted)

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
            t = row_to_tuple(city_id, rec)
            if t:
                batch.append(t)
        if batch:
            cur.executemany(insert_sql, batch)
        total_inserted += len(batch)
        sys.stdout.write(f"\r  CKAN offset {offset:,} … wrote {total_inserted:,} valid rows")
        sys.stdout.flush()

        offset += len(records)
        if offset >= total_available:
            break
        if len(records) < chunk_limit:
            break

    print()
    return total_inserted


def main() -> int:
    parser = argparse.ArgumentParser(description="Load Toronto street trees from CKAN into Postgres.")
    parser.add_argument(
        "--city",
        default=os.environ.get("CITY_SLUG", "toronto"),
        help="City slug rows belong to (default: toronto)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Import at most N valid rows (for testing)",
    )
    parser.add_argument(
        "--truncate-city",
        action="store_true",
        help="Delete existing street_trees for this city before loading",
    )
    args = parser.parse_args()

    _load_dotenv_files()

    base = os.environ.get("TORONTO_CKAN_BASE_URL", DEFAULT_CKAN_BASE).rstrip("/")
    package_id = os.environ.get("TORONTO_STREET_TREES_PACKAGE_ID", DEFAULT_PACKAGE_ID).strip()

    dsn, dsn_err = _resolve_dsn()
    if dsn_err:
        print(dsn_err, file=sys.stderr)
        return 1
    if not dsn:
        print("Missing DATABASE_URL / SUPABASE_DB_URL.", file=sys.stderr)
        return 1

    env_rid = os.environ.get("TORONTO_STREET_TREES_RESOURCE_ID", "").strip()
    if env_rid:
        resource_id, rname = env_rid, "(TORONTO_STREET_TREES_RESOURCE_ID)"
    else:
        resource_id, rname = resolve_datastore_resource_id(base, package_id)

    print(f"CKAN base: {base}")
    print(f"Package: {package_id}")
    print(f"Datastore resource: {resource_id} {rname}")

    try:
        try:
            timeout_s = int(
                os.environ.get("SEED_DB_CONNECT_TIMEOUT", os.environ.get("PGCONNECT_TIMEOUT", "60")),
            )
        except ValueError:
            timeout_s = 60
        from app.db_url import psycopg_connect_kwargs_for_pooler  # noqa: PLC0415

        conn_cm = psycopg.connect(
            dsn,
            connect_timeout=timeout_s,
            **psycopg_connect_kwargs_for_pooler(dsn),
        )
    except psycopg.OperationalError as e:
        print(f"Database connection failed: {e}", file=sys.stderr)
        return 1

    with conn_cm as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            city_id = ensure_city_slug(cur, args.city)
            if args.truncate_city:
                cur.execute("DELETE FROM street_trees WHERE city_id = %s::uuid", (city_id,))
                print(f"Truncated street_trees for city_id={city_id}")
            try:
                n = ingest_street_trees(
                    cur,
                    city_id,
                    base=base,
                    resource_id=resource_id,
                    max_rows=args.limit,
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
    print(f"Done. Upserted {n:,} street tree rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
