from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import create_reset_token, create_token, get_current_user, hash_password, read_reset_token, verify_password
from app.models import Agency, User
from app.schemas import AgencyUpdate, ForgotIn, LoginIn, PrefsIn, ResetIn, SignupIn, TokenOut, UserOut
from app.services.email import send_email, wrap_html

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenOut, status_code=201)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists")
    agency = Agency(name=body.agency_name)
    db.add(agency)
    db.flush()
    user = User(agency_id=agency.id, email=email, name=body.name, password_hash=hash_password(body.password), role="owner")
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(token=create_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return TokenOut(token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/agency", response_model=UserOut)
def update_agency(body: AgencyUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    agency = db.get(Agency, user.agency_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(agency, k, v)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: PrefsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    db.commit()
    return user


@router.post("/forgot", status_code=202)
def forgot(body: ForgotIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user:  # always answer 202 so emails can't be enumerated
        link = f"{get_settings().frontend_url}/reset-password?token={create_reset_token(user)}"
        send_email(
            user.email,
            "Reset your Lumen password",
            f"Use this link to choose a new password (valid for 30 minutes):\n{link}",
            wrap_html("Reset your password", f'<p>This link is valid for 30 minutes.</p><p><a style="color:#38d6ff" href="{link}">Choose a new password</a></p>'),
        )
    return {"ok": True}


@router.post("/reset", response_model=TokenOut)
def reset(body: ResetIn, db: Session = Depends(get_db)):
    uid, pw = read_reset_token(body.token)
    user = db.get(User, uid)
    if not user or user.password_hash[-12:] != pw:
        raise HTTPException(400, "This reset link is invalid or has expired")
    user.password_hash = hash_password(body.password)
    db.commit()
    return TokenOut(token=create_token(user.id), user=UserOut.model_validate(user))
