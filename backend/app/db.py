from collections.abc import AsyncGenerator

import asyncpg

from app.config import settings
from app.db_url import asyncpg_statement_cache_size_for_dsn

_pool: asyncpg.Pool | None = None


async def init_db() -> None:
    global _pool
    if _pool is None:
        stmt_cache = asyncpg_statement_cache_size_for_dsn(settings.database_url)
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=1,
            max_size=10,
            statement_cache_size=stmt_cache,
        )


async def close_db() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    return _pool


async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn
