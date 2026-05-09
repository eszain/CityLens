#!/usr/bin/env python3
"""
Load Toronto **Forest and Land Cover** (2018) polygons into ``map_overlays`` as ``layer_key = land_cover``.

Source package (CKAN): ``forest-and-land-cover``
https://open.toronto.ca/dataset/forest-and-land-cover/

The catalogue page may show **Retired**, but the City still hosts the 2018 File Geodatabase ZIP via CKAN.
There is **no** datastore API for this layer — only file downloads (ZIP containing ``*.gdb``).

Prerequisites (vector read / CRS):
  pip install geopandas pyogrio

Usage::
  py scripts/seed_toronto_land_cover.py
  py scripts/seed_toronto_land_cover.py --layer "Land Cover 2018"
  py scripts/seed_toronto_land_cover.py --geojson scripts/data/my_landcover.geojson

Optional env:
  TORONTO_CKAN_BASE_URL
  TORONTO_FOREST_LAND_COVER_PACKAGE_ID  (default ``forest-and-land-cover``)

Apply migration ``20250509200001_map_overlays_land_cover.sql`` before loading.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "scripts" / "data" / "cache" / "landcover2018"

DEFAULT_CKAN_BASE = "https://ckan0.cf.opendata.inter.prod-toronto.ca"
DEFAULT_PACKAGE_ID = "forest-and-land-cover"

USER_AGENT = "CityLens-seed-script/1.0 (Toronto Open Data CKAN consumer)"

LANDCOVER_SOURCE = "toronto_open_data_landcover_2018"

INSERT_SQL = """
    INSERT INTO map_overlays (city_id, layer_key, label, geom, properties)
    VALUES (%s, 'land_cover', %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), %s::jsonb)
"""

BATCH_SIZE = 250


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


def resolve_gdb_zip_url(base: str, package_id: str) -> tuple[str, str]:
    """Return (download_url, resource_name)."""
    data = ckan_get(base, "package_show", {"id": package_id})
    best: tuple[str, str] | None = None
    for rsrc in data.get("resources") or []:
        fmt = str(rsrc.get("format") or "").upper()
        url = str(rsrc.get("url") or "")
        name = str(rsrc.get("name") or "")
        if fmt == "ZIP" and "gdb" in url.lower():
            best = (url, name)
            break
        if fmt == "ZIP" and "landcover" in url.lower():
            best = (url, name)
    if best:
        return best
    raise SystemExit(
        f"No ZIP File Geodatabase resource found in CKAN package '{package_id}'. "
        "Download manually and use --gdb or --geojson.",
    )


def download_file(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    print(f"Downloading…\n  {url}")
    with urllib.request.urlopen(req, timeout=600) as resp:
        data = resp.read()
    dest.write_bytes(data)
    print(f"Saved {len(data) / 1_000_000:.2f} MB → {dest}")


def extract_zip(zip_path: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(out_dir)
    print(f"Extracted ZIP → {out_dir}")


def find_gdb(root: Path) -> Path | None:
    for p in root.rglob("*.gdb"):
        if p.is_dir():
            return p
    return None


def geometry_to_multipolygon(geom: dict) -> dict:
    t = geom.get("type")
    if t == "Polygon":
        return {"type": "MultiPolygon", "coordinates": [geom["coordinates"]]}
    if t == "MultiPolygon":
        return geom
    raise ValueError(f"Unsupported geometry type: {t}")


def props_to_label(props: dict) -> str:
    for key in (
        "CLASS_NAME",
        "Land_Class",
        "LAND_CLASS",
        "CLASS",
        "Category",
        "DESC_",
        "DESCRIPTION",
        "ZONE",
        "Label",
    ):
        v = props.get(key)
        if v not in (None, "", "None"):
            return str(v)[:500]
    return "Land cover"


def choose_layer_name(gdb_path: Path, explicit: str | None) -> str:
    try:
        import pyogrio as pyo  # noqa: PLC0415
    except ImportError as e:
        raise SystemExit(
            "Missing pyogrio (and GDAL drivers). Install with:\n"
            "  pip install pyogrio geopandas\n"
            f"Original error: {e}",
        ) from e

    # Returns ndarray shape (2, n): row 0 = layer names, row 1 = geometry types (see pyogrio docs).
    raw = pyo.list_layers(str(gdb_path))
    arr = raw[0] if isinstance(raw, tuple) else raw
    try:
        import numpy as np  # noqa: PLC0415

        m = np.asarray(arr)
        if m.ndim == 2 and m.shape[0] == 2:
            names = [str(x) for x in m[0]]
            geom_types = [str(x).lower() if x is not None else "" for x in m[1]]
        elif m.ndim == 2 and m.shape[1] == 2:
            names = [str(x) for x in m[:, 0]]
            geom_types = [str(x).lower() if x is not None else "" for x in m[:, 1]]
        else:
            raise ValueError(f"unexpected ndim/shape {m.ndim} {getattr(m, 'shape', None)}")
    except Exception as e:
        raise SystemExit(f"Could not parse pyogrio.list_layers output: {e}") from e

    if explicit:
        if explicit not in names:
            raise SystemExit(f"Layer {explicit!r} not found. Available: {names}")
        return explicit

    for hint in ("land", "cover", "canopy", "lc"):
        for n in names:
            if hint in n.lower():
                print(f"Using layer (auto): {n}")
                return n

    for name, gtype in zip(names, geom_types):
        if "polygon" in gtype:
            print(f"Using first polygon layer: {name}")
            return name

    raise SystemExit(f"No polygon layer found. Layers: {names}")


def read_gdf_from_gdb(gdb_path: Path, layer: str):
    try:
        import geopandas as gpd  # noqa: PLC0415
    except ImportError as e:
        raise SystemExit(
            "geopandas is required to read the File Geodatabase. Install:\n"
            "  pip install geopandas pyogrio\n"
            f"Original error: {e}",
        ) from e

    gdf = gpd.read_file(str(gdb_path), layer=layer)
    if gdf.crs is not None:
        epsg = gdf.crs.to_epsg()
        if epsg != 4326:
            print(f"Reprojecting from EPSG:{epsg} → 4326…")
            gdf = gdf.to_crs(4326)
    return gdf


def geojson_features_from_path(path: Path) -> list[dict]:
    obj = json.loads(path.read_text(encoding="utf-8"))
    return list(obj.get("features") or [])


def flush_batch(cur: psycopg.Cursor, city_id: str, batch: list[tuple]) -> None:
    if batch:
        prefixed = [(city_id, lbl, gj, pj) for lbl, gj, pj in batch]
        cur.executemany(INSERT_SQL, prefixed)


def ingest_geodataframe(cur: psycopg.Cursor, city_id: str, gdf, *, limit: int | None) -> int:
    from shapely.geometry import mapping as shp_mapping  # noqa: PLC0415

    geom_col = gdf.geometry.name
    meta_cols = [c for c in gdf.columns if c != geom_col]

    total = 0
    batch: list[tuple[str, str, str]] = []

    for idx, row in gdf.iterrows():
        if limit is not None and total >= limit:
            break
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        try:
            gj_dict = shp_mapping(geom)
            mp = geometry_to_multipolygon(gj_dict)
        except (ValueError, TypeError):
            continue

        props = {k: row[k] for k in meta_cols}
        if hasattr(props, "to_dict"):
            props = props.to_dict()
        try:
            serializable = json.loads(json.dumps(props, default=str))
        except (TypeError, ValueError):
            serializable = {str(k): str(v) for k, v in props.items()}
        serializable["source"] = LANDCOVER_SOURCE

        label = props_to_label(serializable)
        batch.append((label, json.dumps(mp), json.dumps(serializable)))
        total += 1

        if len(batch) >= BATCH_SIZE:
            flush_batch(cur, city_id, batch)
            batch.clear()
            sys.stdout.write(f"\r  Inserted {total:,} land_cover features…")
            sys.stdout.flush()

    flush_batch(cur, city_id, batch)
    print()
    return total


def ingest_geojson_features(cur: psycopg.Cursor, city_id: str, features: list[dict], *, limit: int | None) -> int:
    total = 0
    batch: list[tuple[str, str, str]] = []

    for f in features:
        if limit is not None and total >= limit:
            break
        geom = f.get("geometry")
        if not geom:
            continue
        try:
            mp = geometry_to_multipolygon(geom)
        except ValueError:
            continue
        props = dict(f.get("properties") or {})
        props["source"] = LANDCOVER_SOURCE
        label = props_to_label(props)
        batch.append((label, json.dumps(mp), json.dumps(props, default=str)))
        total += 1

        if len(batch) >= BATCH_SIZE:
            flush_batch(cur, city_id, batch)
            batch.clear()

    flush_batch(cur, city_id, batch)
    return total


def main() -> int:
    parser = argparse.ArgumentParser(description="Load Toronto 2018 land cover into map_overlays.land_cover.")
    parser.add_argument("--city", default=os.environ.get("CITY_SLUG", "toronto"))
    parser.add_argument("--layer", default=None, help="GDB layer name (default: auto-detect)")
    parser.add_argument("--limit", type=int, default=None, metavar="N", help="Import at most N polygons")
    parser.add_argument("--geojson", type=Path, default=None, help="Use this GeoJSON instead of CKAN/GDB")
    parser.add_argument("--gdb", type=Path, default=None, help="Path to extracted .gdb directory")
    parser.add_argument("--zip-cache", type=Path, default=CACHE_DIR / "landcover2018_gdb.zip")
    parser.add_argument("--extract-dir", type=Path, default=CACHE_DIR / "extracted")
    parser.add_argument("--force-download", action="store_true")
    parser.add_argument("--skip-download", action="store_true", help="Use existing cache only")
    args = parser.parse_args()

    _load_dotenv_files()

    dsn, dsn_err = _resolve_dsn()
    if dsn_err:
        print(dsn_err, file=sys.stderr)
        return 1
    if not dsn:
        print("Missing DATABASE_URL.", file=sys.stderr)
        return 1

    try:
        timeout_s = int(os.environ.get("SEED_DB_CONNECT_TIMEOUT", os.environ.get("PGCONNECT_TIMEOUT", "60")))
    except ValueError:
        timeout_s = 60
    from app.db_url import psycopg_connect_kwargs_for_pooler  # noqa: PLC0415

    gdb_path = args.gdb

    if args.geojson:
        geo_path = args.geojson.resolve()
        feats = geojson_features_from_path(geo_path)
        print(f"GeoJSON features: {len(feats)} from {geo_path}")
        conn_cm = psycopg.connect(dsn, connect_timeout=timeout_s, **psycopg_connect_kwargs_for_pooler(dsn))
        with conn_cm as conn:
            conn.autocommit = False
            with conn.cursor() as cur:
                city_id = ensure_city_slug(cur, args.city)
                cur.execute(
                    """
                    DELETE FROM map_overlays
                    WHERE city_id = %s::uuid AND layer_key = 'land_cover'
                      AND (properties->>'source') = %s
                    """,
                    (city_id, LANDCOVER_SOURCE),
                )
                n = ingest_geojson_features(cur, city_id, feats, limit=args.limit)
                conn.commit()
        print(f"Done. Inserted {n:,} rows from GeoJSON.")
        return 0

    base = os.environ.get("TORONTO_CKAN_BASE_URL", DEFAULT_CKAN_BASE).rstrip("/")
    package_id = os.environ.get("TORONTO_FOREST_LAND_COVER_PACKAGE_ID", DEFAULT_PACKAGE_ID).strip()

    zip_path = args.zip_cache.resolve()
    extract_dir = args.extract_dir.resolve()

    if gdb_path is None:
        if not args.skip_download and (args.force_download or not zip_path.is_file()):
            zip_url, rname = resolve_gdb_zip_url(base, package_id)
            print(f"CKAN resource: {rname}")
            download_file(zip_url, zip_path)
        elif not zip_path.is_file():
            raise SystemExit(f"ZIP not found at {zip_path}. Run without --skip-download or place the file.")

        if extract_dir.exists() and args.force_download:
            shutil.rmtree(extract_dir)

        gdb_path = find_gdb(extract_dir)
        if gdb_path is None:
            extract_zip(zip_path, extract_dir)
            gdb_path = find_gdb(extract_dir)
        if gdb_path is None:
            raise SystemExit(f"No .gdb folder under {extract_dir} after extracting {zip_path}")

    gdb_path = gdb_path.resolve()
    print(f"File Geodatabase: {gdb_path}")

    layer_name = choose_layer_name(gdb_path, args.layer)
    print(f"Reading layer {layer_name!r}…")
    gdf = read_gdf_from_gdb(gdb_path, layer_name)
    print(f"Rows: {len(gdf):,}; columns: {list(gdf.columns)}")

    conn_cm = psycopg.connect(dsn, connect_timeout=timeout_s, **psycopg_connect_kwargs_for_pooler(dsn))
    with conn_cm as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            city_id = ensure_city_slug(cur, args.city)
            cur.execute(
                """
                DELETE FROM map_overlays
                WHERE city_id = %s::uuid AND layer_key = 'land_cover'
                  AND (properties->>'source') = %s
                """,
                (city_id, LANDCOVER_SOURCE),
            )
            n = ingest_geodataframe(cur, city_id, gdf, limit=args.limit)
            conn.commit()

    print(f"Done. Inserted {n:,} land_cover polygons.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
