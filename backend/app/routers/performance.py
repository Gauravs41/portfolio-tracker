"""Performance endpoints for watchlist items and holdings."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Holding, Watchlist
from app.schemas import (
    HoldingPerformanceRow,
    HoldingsPerformanceResponse,
    PerformanceRow,
)
from app.services import performance, upstox
from app.services.upstox import UpstoxError

router = APIRouter(prefix="/performance", tags=["performance"])


def _safe_ltp(instrument_keys: list[str]) -> dict[str, dict]:
    try:
        return upstox.get_ltp(instrument_keys)
    except UpstoxError:
        return {}


@router.get("/watchlist/{watchlist_id}", response_model=list[PerformanceRow])
def watchlist_performance(watchlist_id: int, db: Session = Depends(get_db)):
    wl = db.get(Watchlist, watchlist_id)
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    keys = [it.instrument_key for it in wl.items]
    ltp = _safe_ltp(keys)

    rows: list[PerformanceRow] = []
    for it in wl.items:
        last_price = ltp.get(it.instrument_key, {}).get("last_price")
        metrics = performance.compute_metrics(it.instrument_key, last_price)
        rows.append(
            PerformanceRow(
                instrument_key=it.instrument_key,
                symbol=it.symbol,
                name=it.name,
                **metrics,
            )
        )
    return rows


@router.get("/holdings", response_model=HoldingsPerformanceResponse)
def holdings_performance(db: Session = Depends(get_db)):
    holdings = db.query(Holding).order_by(Holding.id).all()
    keys = [h.instrument_key for h in holdings]
    ltp = _safe_ltp(keys)

    rows: list[HoldingPerformanceRow] = []
    # First pass: compute market values to derive allocation %.
    computed: list[tuple[Holding, dict, float | None]] = []
    total_mv = 0.0
    for h in holdings:
        last_price = ltp.get(h.instrument_key, {}).get("last_price")
        metrics = performance.compute_metrics(h.instrument_key, last_price)
        price = metrics.get("last_price")
        mv = price * h.quantity if price is not None else None
        if mv is not None:
            total_mv += mv
        computed.append((h, metrics, mv))

    total_invested = 0.0
    total_pnl = 0.0
    for h, metrics, mv in computed:
        invested = h.avg_buy_price * h.quantity
        total_invested += invested
        pnl = (mv - invested) if mv is not None else None
        if pnl is not None:
            total_pnl += pnl
        rows.append(
            HoldingPerformanceRow(
                id=h.id,
                instrument_key=h.instrument_key,
                symbol=h.symbol,
                name=h.name,
                quantity=h.quantity,
                avg_buy_price=h.avg_buy_price,
                market_value=round(mv, 2) if mv is not None else None,
                invested=round(invested, 2),
                pnl=round(pnl, 2) if pnl is not None else None,
                pnl_pct=round(pnl / invested * 100, 2) if pnl is not None and invested else None,
                allocation_pct=round(mv / total_mv * 100, 2) if mv is not None and total_mv else None,
                sector=h.sector,
                **metrics,
            )
        )

    return HoldingsPerformanceResponse(
        total_market_value=round(total_mv, 2),
        total_invested=round(total_invested, 2),
        total_pnl=round(total_pnl, 2),
        total_pnl_pct=round(total_pnl / total_invested * 100, 2) if total_invested else 0,
        rows=rows,
    )
