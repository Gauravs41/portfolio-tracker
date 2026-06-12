"""Holdings CRUD (manual entry)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Holding
from app.schemas import HoldingCreate, HoldingOut, HoldingUpdate

router = APIRouter(prefix="/holdings", tags=["holdings"])


@router.get("", response_model=list[HoldingOut])
def list_holdings(db: Session = Depends(get_db)):
    return db.scalars(select(Holding).order_by(Holding.id)).all()


@router.post("", response_model=HoldingOut, status_code=201)
def create_holding(payload: HoldingCreate, db: Session = Depends(get_db)):
    holding = Holding(**payload.model_dump())
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return holding


@router.patch("/{holding_id}", response_model=HoldingOut)
def update_holding(holding_id: int, payload: HoldingUpdate, db: Session = Depends(get_db)):
    holding = db.get(Holding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(holding, field, value)
    db.commit()
    db.refresh(holding)
    return holding


@router.delete("/{holding_id}", status_code=204)
def delete_holding(holding_id: int, db: Session = Depends(get_db)):
    holding = db.get(Holding, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    db.delete(holding)
    db.commit()
