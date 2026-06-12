"""Diversification breakdown by sector (manual tags) and SME/mainboard."""
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Holding
from app.schemas import DiversificationResponse, DiversificationSlice
from app.services import upstox
from app.services.upstox import UpstoxError

router = APIRouter(prefix="/diversification", tags=["diversification"])


def _slices(buckets: dict[str, dict], total: float) -> list[DiversificationSlice]:
    out = []
    for label, agg in buckets.items():
        out.append(
            DiversificationSlice(
                label=label,
                value=round(agg["value"], 2),
                pct=round(agg["value"] / total * 100, 2) if total else 0,
                count=agg["count"],
            )
        )
    return sorted(out, key=lambda s: s.value, reverse=True)


@router.get("", response_model=DiversificationResponse)
def diversification(db: Session = Depends(get_db)):
    holdings = db.query(Holding).all()
    keys = [h.instrument_key for h in holdings]

    try:
        ltp = upstox.get_ltp(keys)
    except UpstoxError:
        ltp = {}

    by_sector: dict[str, dict] = defaultdict(lambda: {"value": 0.0, "count": 0})
    by_board: dict[str, dict] = defaultdict(lambda: {"value": 0.0, "count": 0})
    total = 0.0

    for h in holdings:
        price = ltp.get(h.instrument_key, {}).get("last_price")
        mv = price * h.quantity if price is not None else h.avg_buy_price * h.quantity
        total += mv

        sector = h.sector or "Untagged"
        by_sector[sector]["value"] += mv
        by_sector[sector]["count"] += 1

        ins = None
        try:
            ins = upstox.get_instrument(h.instrument_key)
        except UpstoxError:
            ins = None
        board = ins["board_type"] if ins else "MAINBOARD"
        by_board[board]["value"] += mv
        by_board[board]["count"] += 1

    return DiversificationResponse(
        total_market_value=round(total, 2),
        by_sector=_slices(by_sector, total),
        by_board=_slices(by_board, total),
    )
