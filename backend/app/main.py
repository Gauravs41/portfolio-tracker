"""FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import Base, engine
from app.routers import (
    diversification,
    holdings,
    instrument_meta,
    instruments,
    performance,
    watchlists,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Create tables if they don't exist (safe to run alongside schema.sql).
    Base.metadata.create_all(bind=engine)
    yield


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
app.include_router(diversification.router)


@app.get("/health", tags=["meta"])
def health():
    return {
        "status": "ok",
        "upstox_configured": bool(settings.upstox_token),
        "db_configured": bool(settings.database_url),
    }
