"""Resolve PostgreSQL DATABASE_URL from common Supabase/local env conventions."""

from __future__ import annotations

from typing import Mapping
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

# Default Postgres port when Supabase CLI / Docker stack exposes API at :54321
LOCAL_SUPABASE_API_MARKERS = ("localhost:54321", "127.0.0.1:54321")
LOCAL_POSTGRES_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
LEGACY_DOCKER_FALLBACK = "postgresql://postgres:postgres@localhost:54322/postgres"


def sanitize_libpq_postgres_uri(uri: str) -> str:
    """Strip params libpq rejects (e.g. Supabase ``pgbouncer=true`` for Prisma-only clients)."""
    s = uri.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        s = s[1:-1].strip()

    parsed = urlparse(s)
    if parsed.scheme not in ("postgres", "postgresql"):
        return s

    pairs = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if k.lower() != "pgbouncer"]
    new_query = urlencode(pairs)
    return urlunparse(parsed._replace(query=new_query))


def asyncpg_statement_cache_size_for_dsn(uri: str) -> int:
    """
    Supabase transaction pool uses PgBouncer pool_mode=transaction on port **6543**;
    prepared statements collide across clients (DuplicatePreparedStatementError).
    Disable asyncpg's statement cache there; session pool (**5432**) can use caching.
    """
    try:
        if urlparse(uri.strip()).port == 6543:
            return 0
    except (ValueError, TypeError):
        pass
    return 100


def psycopg_connect_kwargs_for_pooler(uri: str) -> dict[str, object]:
    """
    Extra ``psycopg.connect()`` kwargs for Supabase transaction pool (PgBouncer on **6543**).
    Disables statement preparation so pooled connections behave like asyncpg with statement_cache=0.
    """
    try:
        if urlparse(uri.strip()).port == 6543:
            return {"prepare_threshold": None}
    except (ValueError, TypeError):
        pass
    return {}


def looks_like_local_supabase_api(supabase_url: str | None) -> bool:
    if not supabase_url:
        return False
    u = supabase_url.strip().lower()
    return any(m in u for m in LOCAL_SUPABASE_API_MARKERS)


def looks_like_cloud_supabase_api(supabase_url: str | None) -> bool:
    if not supabase_url:
        return False
    u = supabase_url.strip().lower()
    if looks_like_local_supabase_api(supabase_url):
        return False
    return "supabase.co" in u


def resolve_database_url(
    database_url: str | None,
    *,
    supabase_db_url: str | None = None,
    supabase_url: str | None = None,
) -> tuple[str | None, str | None]:
    """
    Returns (effective_url_or_none, error_message_or_none).

    Priority: DATABASE_URL, then SUPABASE_DB_URL, then local SUPABASE_URL inference, else legacy localhost.
    Hosted Supabase (https://*.supabase.co) without Postgres URL yields an error.
    """
    u = database_url.strip() if database_url else ""
    if u:
        return sanitize_libpq_postgres_uri(u), None

    sdb = supabase_db_url.strip() if supabase_db_url else ""
    if sdb:
        return sanitize_libpq_postgres_uri(sdb), None

    if looks_like_local_supabase_api(supabase_url):
        return sanitize_libpq_postgres_uri(LOCAL_POSTGRES_URL), None

    if looks_like_cloud_supabase_api(supabase_url):
        return None, (
            "Hosted Supabase: set DATABASE_URL or SUPABASE_DB_URL to your Postgres URI "
            "(Dashboard -> Database -> Connection string). SUPABASE_URL is the HTTP API "
            "(port 54321 locally), not the Postgres connection string."
        )

    return sanitize_libpq_postgres_uri(LEGACY_DOCKER_FALLBACK), None


def resolve_database_url_from_environ(environ: Mapping[str, str]) -> tuple[str | None, str | None]:
    return resolve_database_url(
        environ.get("DATABASE_URL"),
        supabase_db_url=environ.get("SUPABASE_DB_URL"),
        supabase_url=environ.get("SUPABASE_URL"),
    )
