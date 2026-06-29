"""Alert rules CRUD + triggered-notification feed."""
import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import AlertRule, Notification
from app.schemas import (
    AlertRuleCreate,
    AlertRuleOut,
    AlertRuleUpdate,
    NotificationOut,
)
from app.services import alerts, notifications, scheduler

router = APIRouter(prefix="/alerts", tags=["alerts"])


# ---- External cron trigger (for sleeping free-tier hosts) ----
@router.post("/run")
def run_alerts(x_cron_secret: str | None = Header(default=None)):
    """Evaluate all active rules once. Intended for an external scheduler
    (e.g. a Render Cron Job) to drive alerts where the in-process scheduler
    is asleep. Guarded by the ``CRON_SECRET`` shared secret; disabled (404)
    when no secret is configured."""
    settings = get_settings()
    secret = settings.cron_secret
    if not secret:
        raise HTTPException(status_code=404, detail="Not found")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    fired = scheduler.evaluate_active_alerts()
    return {"fired": fired}


# ---- Alert rules ----
@router.get("", response_model=list[AlertRuleOut])
def list_alerts(
    instrument_key: str | None = Query(default=None),
    active_only: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    q = db.query(AlertRule)
    if instrument_key:
        q = q.filter(AlertRule.instrument_key == instrument_key)
    if active_only:
        q = q.filter(AlertRule.is_active.is_(True))
    return q.order_by(AlertRule.created_at.desc()).all()


@router.post("", response_model=AlertRuleOut, status_code=201)
def create_alert(payload: AlertRuleCreate, db: Session = Depends(get_db)):
    rule = AlertRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/{alert_id}", response_model=AlertRuleOut)
def update_alert(alert_id: int, payload: AlertRuleUpdate, db: Session = Depends(get_db)):
    rule = db.get(AlertRule, alert_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert not found")
    data = payload.model_dump(exclude_unset=True)
    # Reactivating or changing the condition resets the cross baseline so the
    # rule doesn't immediately fire on stale state.
    if "is_active" in data and data["is_active"] and not rule.is_active:
        rule.last_value = None
    if "condition" in data or "value" in data:
        rule.last_value = None
    for k, v in data.items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{alert_id}", status_code=204)
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    rule = db.get(AlertRule, alert_id)
    if rule:
        db.delete(rule)
        db.commit()


@router.post("/{alert_id}/test", response_model=NotificationOut)
def test_alert(alert_id: int, db: Session = Depends(get_db)):
    """Fire a test notification for a rule (verifies Telegram + browser path)."""
    rule = db.get(AlertRule, alert_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert not found")
    note = notifications.dispatch(
        db,
        title=f"[TEST] {alerts.describe(rule)}",
        body=rule.message.strip() or "Test notification",
        instrument_key=rule.instrument_key,
        symbol=rule.symbol,
        alert_id=rule.id,
    )
    db.commit()
    db.refresh(note)
    return note


# ---- Notification feed (polled by the browser) ----
@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Notification)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    return q.order_by(Notification.created_at.desc()).limit(limit).all()


@router.post("/notifications/{note_id}/read", response_model=NotificationOut)
def mark_read(note_id: int, db: Session = Depends(get_db)):
    note = db.get(Notification, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found")
    note.is_read = True
    db.commit()
    db.refresh(note)
    return note


@router.post("/notifications/read-all", status_code=204)
def mark_all_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.is_read.is_(False)).update(
        {Notification.is_read: True}
    )
    db.commit()
