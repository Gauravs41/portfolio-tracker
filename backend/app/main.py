"""FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import Base, engine
from app.migrations import run_migrations
from app.routers import (
    alerts,
    candles,
    chart_drawings,
    diversification,
    holdings,
    instrument_meta,
    instruments,
    performance,
    watchlists,
)
from app.services import scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Create tables if they don't exist (safe to run alongside schema.sql).
    Base.metadata.create_all(bind=engine)
    # Additively bring older alert/notification tables up to the current schema.
    run_migrations(engine)
    # Start the background alert evaluator.
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown()


app = FastAPI(title="Portfolio Tracker API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(instruments.router)
app.include_router(instrument_meta.router)
app.include_router(watchlists.router)
app.include_router(holdings.router)
app.include_router(performance.router)
app.include_router(candles.router)
app.include_router(chart_drawings.router)
app.include_router(diversification.router)
app.include_router(alerts.router)


@app.get("/health", tags=["meta"])
def health():
    return {
        "status": "ok",
        "upstox_configured": bool(settings.upstox_token),
        "db_configured": bool(settings.database_url),
    }
