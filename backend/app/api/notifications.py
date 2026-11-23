from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models import Alert, User
from app.schemas import AlertOut
from app.services.alerts import run_alert_checks

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Alert).where(Alert.agency_id == user.agency_id).order_by(Alert.created_at.desc(), Alert.id.desc()).limit(30)).all()


@router.post("/read-all", status_code=204)
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(update(Alert).where(Alert.agency_id == user.agency_id, Alert.read.is_(False)).values(read=True))
    db.commit()


@router.post("/check")
def check_now(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Run the week-over-week visibility check for this agency right now."""
    return {"created": len(run_alert_checks(db, user.agency_id))}
