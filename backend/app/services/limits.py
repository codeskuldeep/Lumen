"""Guards that stop a user (or a double-click) from exhausting the paid engine APIs."""

import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import ACTIVE_STATUSES, Client, Draft, Prompt, Run, User
from app.services.engines import ENGINE_NAMES, engine_modes

_hits: dict[tuple, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def _fmt_wait(seconds: float) -> str:
    m = max(1, int(seconds // 60))
    return f"{m // 60}h {m % 60}m" if m >= 60 else f"{m} min"


def _throttle(user_id: int, kind: str = "scan", limit: int | None = None) -> None:
    """Sliding window: at most N presses per minute per user (in-memory, single API instance)."""
    limit, now = limit or get_settings().scan_starts_per_minute, time.monotonic()
    with _lock:
        q = _hits[(kind, user_id)]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(429, f"You're doing that too fast. Try again in {int(60 - (now - q[0])) + 1} seconds.")
        q.append(now)


def usage_today(db: Session, agency_id: int) -> dict:
    """Live (paid) answers started in the last 24 h by this agency. Demo engines are free and not counted."""
    s = get_settings()
    live = [n for n, m in engine_modes().items() if m == "live"]
    since = datetime.now(UTC) - timedelta(hours=24)
    base = select(Run).join(Client, Client.id == Run.client_id).where(Client.agency_id == agency_id, Run.created_at >= since, Run.engine.in_(live))
    used = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    oldest = db.scalar(select(func.min(Run.created_at)).join(Client, Client.id == Run.client_id).where(Client.agency_id == agency_id, Run.created_at >= since, Run.engine.in_(live)))
    resets_in = None
    if oldest is not None:
        if oldest.tzinfo is None:
            oldest = oldest.replace(tzinfo=UTC)
        resets_in = max(0.0, (oldest + timedelta(hours=24) - datetime.now(UTC)).total_seconds())
    return {"used": used, "limit": s.daily_answer_limit, "live_engines": len(live), "next_slot_in_s": resets_in}


def check_can_scan(db: Session, user: User, client_id: int, prompts: list[Prompt]) -> None:
    """Raise a 409/429 with a human-readable reason unless this scan may start."""
    s = get_settings()
    _throttle(user.id)

    active_here = db.scalar(select(func.count(Run.id)).where(Run.client_id == client_id, Run.status.in_(ACTIVE_STATUSES))) or 0
    if active_here:
        raise HTTPException(409, "A scan is already running for this client. Wait for it to finish.")

    active_agency = db.scalar(select(func.count(Run.id)).join(Client, Client.id == Run.client_id).where(Client.agency_id == user.agency_id, Run.status.in_(ACTIVE_STATUSES))) or 0
    needed_total = len(prompts) * len(ENGINE_NAMES)
    if active_agency + needed_total > s.max_active_answers:
        raise HTTPException(429, f"Too many answers are already in progress ({active_agency}). Wait for them to finish, or scan fewer prompts (limit {s.max_active_answers} at once).")

    u = usage_today(db, user.agency_id)
    needed_live = len(prompts) * u["live_engines"]
    if u["used"] + needed_live > s.daily_answer_limit:
        left = max(0, s.daily_answer_limit - u["used"])
        when = f" Capacity frees up gradually; the next slot opens in about {_fmt_wait(u['next_slot_in_s'])}." if u["next_slot_in_s"] else ""
        raise HTTPException(429, f"Daily limit reached: this scan needs {needed_live} live answers but only {left} of {s.daily_answer_limit} are left in the last 24 hours. Scan fewer prompts or try later.{when}")


def drafts_today(db: Session, agency_id: int) -> dict:
    s = get_settings()
    since = datetime.now(UTC) - timedelta(hours=24)
    used = db.scalar(select(func.count(Draft.id)).where(Draft.agency_id == agency_id, Draft.created_at >= since)) or 0
    return {"used": used, "limit": s.daily_draft_limit, "enabled": bool(s.anthropic_api_key)}


def check_can_draft(db: Session, user: User) -> None:
    _throttle(user.id, "draft", 5)
    d = drafts_today(db, user.agency_id)
    if d["used"] >= d["limit"]:
        raise HTTPException(429, f"Daily drafting limit reached ({d['limit']} drafts per 24 hours). Try again later.")
