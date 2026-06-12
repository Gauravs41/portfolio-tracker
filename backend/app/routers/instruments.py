"""Instrument search/lookup backed by the Upstox instruments master."""
from fastapi import APIRouter, HTTPException, Query

from app.schemas import InstrumentOut
from app.services import upstox
from app.services.upstox import UpstoxError

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("/search", response_model=list[InstrumentOut])
def search(q: str = Query(min_length=1), limit: int = Query(default=20, le=50)):
    try:
        return upstox.search_instruments(q, limit)
    except UpstoxError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/{instrument_key:path}", response_model=InstrumentOut)
def get_one(instrument_key: str):
    try:
        ins = upstox.get_instrument(instrument_key)
    except UpstoxError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if not ins:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return ins
