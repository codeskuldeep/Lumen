import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Alert, Client, User
from app.services import metrics
from app.services.email import send_email, wrap_html

log = logging.getLogger(__name__)
THRESHOLD = 10.0  # percentage points
MIN_RUNS = 8


def _users(db: Session, agency_id: int) -> list[User]:
    return list(db.scalars(select(User).where(User.agency_id == agency_id, User.email_alerts.is_(True))))


def check_client(db: Session, client: Client) -> Alert | None:
    ov = metrics.client_overview(db, client.id, 7)
    cur, prev = ov["current"], ov["previous"]
    if cur["runs"] < MIN_RUNS or prev["runs"] < MIN_RUNS:
        return None
    delta = cur["visibility"] - prev["visibility"]
    if abs(delta) < THRESHOLD:
        return None
    kind = "drop" if delta < 0 else "gain"
    recent = db.scalar(select(Alert.id).where(Alert.client_id == client.id, Alert.kind == kind, Alert.created_at >= datetime.now(UTC) - timedelta(days=6)))
    if recent:
        return None
    verb = "dropped" if delta < 0 else "rose"
    alert = Alert(
        agency_id=client.agency_id,
        client_id=client.id,
        kind=kind,
        message=f"{client.name}'s AI visibility {verb} {abs(delta):.1f} pts week-over-week ({prev['visibility']}% → {cur['visibility']}%).",
    )
    db.add(alert)
    db.commit()
    return alert


def run_alert_checks(db: Session, agency_id: int | None = None) -> list[Alert]:
    q = select(Client)
    if agency_id:
        q = q.where(Client.agency_id == agency_id)
    created = [a for c in db.scalars(q) if (a := check_client(db, c))]
    front = get_settings().frontend_url
    by_agency: dict[int, list[Alert]] = {}
    for a in created:
        by_agency.setdefault(a.agency_id, []).append(a)
    for aid, alerts in by_agency.items():
        lines = "\n".join(f"- {a.message}" for a in alerts)
        html = wrap_html("Visibility alert", "".join(f"<p>{a.message}</p>" for a in alerts) + f'<p><a style="color:#38d6ff" href="{front}/dashboard">Open dashboard</a></p>')
        for u in _users(db, aid):
            send_email(u.email, "Lumen: AI visibility alert", f"{lines}\n\n{front}/dashboard", html)
    return created
