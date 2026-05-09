from collections.abc import AsyncGenerator
from typing import Annotated

import asyncpg
from fastapi import Depends

from app.db import get_pool


async def db_conn() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn


DbConn = Annotated[asyncpg.Connection, Depends(db_conn)]
