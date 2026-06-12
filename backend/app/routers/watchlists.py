"""Watchlist CRUD and item management."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Watchlist, WatchlistItem
from app.schemas import (
    WatchlistCreate,
    WatchlistItemCreate,
    WatchlistItemOut,
    WatchlistOut,
)

router = APIRouter(prefix="/watchlists", tags=["watchlists"])


@router.get("", response_model=list[WatchlistOut])
def list_watchlists(db: Session = Depends(get_db)):
    return db.scalars(select(Watchlist).order_by(Watchlist.id)).all()


@router.post("", response_model=WatchlistOut, status_code=201)
def create_watchlist(payload: WatchlistCreate, db: Session = Depends(get_db)):
    wl = Watchlist(name=payload.name)
    db.add(wl)
    db.commit()
    db.refresh(wl)
    return wl


@router.delete("/{watchlist_id}", status_code=204)
def delete_watchlist(watchlist_id: int, db: Session = Depends(get_db)):
    wl = db.get(Watchlist, watchlist_id)
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    db.delete(wl)
    db.commit()


@router.post("/{watchlist_id}/items", response_model=WatchlistItemOut, status_code=201)
def add_item(watchlist_id: int, payload: WatchlistItemCreate, db: Session = Depends(get_db)):
    wl = db.get(Watchlist, watchlist_id)
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    exists = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist_id,
            WatchlistItem.instrument_key == payload.instrument_key,
        )
    )
    if exists:
        raise HTTPException(status_code=409, detail="Already in watchlist")
    next_order = len(wl.items)
    item = WatchlistItem(
        watchlist_id=watchlist_id,
        instrument_key=payload.instrument_key,
        symbol=payload.symbol,
        name=payload.name,
        sort_order=next_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{watchlist_id}/items/{item_id}", status_code=204)
def remove_item(watchlist_id: int, item_id: int, db: Session = Depends(get_db)):
    item = db.get(WatchlistItem, item_id)
    if not item or item.watchlist_id != watchlist_id:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
