from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import close_db, init_db
from app.routers import blocks, equity, ingest, interventions, layers, risk_scores, work_orders


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(title="CityLens API", version="0.1.0", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(blocks.router)
app.include_router(work_orders.router)
app.include_router(interventions.router)
app.include_router(equity.router)
app.include_router(layers.router)
app.include_router(ingest.router)
app.include_router(risk_scores.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
