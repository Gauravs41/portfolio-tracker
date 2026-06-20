"""Per-instrument chart drawings (trend lines, rectangles, fib, etc.)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ChartDrawing
from app.schemas import ChartDrawingsOut, ChartDrawingsUpdate

router = APIRouter(prefix="/chart-drawings", tags=["chart-drawings"])


@router.get("/{instrument_key:path}", response_model=ChartDrawingsOut)
def get_drawings(instrument_key: str, db: Session = Depends(get_db)):
    row = db.get(ChartDrawing, instrument_key)
    if not row:
        return ChartDrawingsOut(instrument_key=instrument_key, drawings=[])
    return row


@router.put("/{instrument_key:path}", response_model=ChartDrawingsOut)
def save_drawings(
    instrument_key: str,
    payload: ChartDrawingsUpdate,
    db: Session = Depends(get_db),
):
    row = db.get(ChartDrawing, instrument_key)
    if not row:
        row = ChartDrawing(instrument_key=instrument_key)
        db.add(row)
    row.drawings = payload.drawings
    db.commit()
    db.refresh(row)
    return row
