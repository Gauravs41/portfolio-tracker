"""Per-instrument metadata: free-form tags + notes (global, shared across views)."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import InstrumentMeta
from app.schemas import InstrumentMetaOut, InstrumentMetaUpdate

router = APIRouter(prefix="/instrument-meta", tags=["instrument-meta"])


@router.get("/tags", response_model=list[str])
def list_tags(db: Session = Depends(get_db)):
    """Distinct tags across all instruments, sorted, for autocomplete."""
    seen: set[str] = set()
    for tags in db.scalars(select(InstrumentMeta.tags)).all():
        for t in tags or []:
            if t:
                seen.add(t)
    return sorted(seen, key=str.lower)


@router.get("/{instrument_key}", response_model=InstrumentMetaOut)
def get_instrument_meta(instrument_key: str, db: Session = Depends(get_db)):
    meta = db.get(InstrumentMeta, instrument_key)
    if not meta:
        return InstrumentMetaOut(instrument_key=instrument_key)
    return meta


@router.put("/{instrument_key}", response_model=InstrumentMetaOut)
def upsert_instrument_meta(
    instrument_key: str,
    payload: InstrumentMetaUpdate,
    db: Session = Depends(get_db),
):
    meta = db.get(InstrumentMeta, instrument_key)
    if not meta:
        meta = InstrumentMeta(instrument_key=instrument_key, symbol=instrument_key)
        db.add(meta)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(meta, field, value)
    db.commit()
    db.refresh(meta)
    return meta
