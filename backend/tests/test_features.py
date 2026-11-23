from datetime import UTC, datetime, timedelta

from app.core.db import SessionLocal
from app.models import Client, Prompt, Run, User
from app.services import email as mail
from app.services.alerts import run_alert_checks


def signup(client, email="t@x.com"):
    r = client.post("/api/auth/signup", json={"agency_name": "Agency", "name": "T", "email": email, "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_password_reset(client):
    signup(client)
    mail.outbox.clear()
    assert client.post("/api/auth/forgot", json={"email": "nobody@x.com"}).status_code == 202
    assert not mail.outbox
    assert client.post("/api/auth/forgot", json={"email": "t@x.com"}).status_code == 202
    token = mail.outbox[-1]["text"].split("token=")[1].split()[0]
    assert client.post("/api/auth/reset", json={"token": token, "password": "newpassword1"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": "t@x.com", "password": "newpassword1"}).status_code == 200
    # token is single-use: password hash changed
    assert client.post("/api/auth/reset", json={"token": token, "password": "another-pass1"}).status_code == 400
    assert client.post("/api/auth/reset", json={"token": "garbage", "password": "another-pass1"}).status_code == 400


def _seed(db, hit_prev, hit_cur, n=10):
    user = db.query(User).first()
    c = Client(agency_id=user.agency_id, name="Acme", aliases=[])
    db.add(c)
    db.flush()
    p = Prompt(client_id=c.id, text="q")
    db.add(p)
    db.flush()
    now = datetime.now(UTC)
    for age, hits in ((10, hit_prev), (2, hit_cur)):
        for i in range(n):
            db.add(Run(prompt_id=p.id, client_id=c.id, engine="chatgpt", status="done", brand_mentioned=i < hits, created_at=now - timedelta(days=age)))
    db.commit()


def test_alerts_and_prefs(client):
    h = signup(client)
    mail.outbox.clear()
    with SessionLocal() as db:
        _seed(db, hit_prev=9, hit_cur=3)
        assert len(run_alert_checks(db)) == 1
        assert run_alert_checks(db) == []  # deduped
    assert any("alert" in m["subject"].lower() for m in mail.outbox)
    alerts = client.get("/api/alerts", headers=h).json()
    assert alerts[0]["kind"] == "drop" and not alerts[0]["read"]
    client.post("/api/alerts/read-all", headers=h)
    assert client.get("/api/alerts", headers=h).json()[0]["read"]
    assert client.patch("/api/auth/me", headers=h, json={"email_alerts": False}).json()["email_alerts"] is False
