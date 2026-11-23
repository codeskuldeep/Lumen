from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, lazyload

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import get_current_user
from app.models import ACTIVE_STATUSES, Client, Competitor, Draft, Mention, Prompt, Run, User
from app.schemas import ClientCard, ClientIn, ClientOut, ClientUpdate, DraftIn, PromptBulkIn, PromptOut, PromptUpdate, RunDetail, RunOut, SuggestIn
from app.services import gaps, metrics
from app.services.drafts import SYSTEM, DraftError, build_prompt, call_claude
from app.services.engines import ENGINE_NAMES, engine_modes
from app.services.limits import check_can_draft, check_can_scan, drafts_today, usage_today
from app.services.plans import DEFAULT_PLAN, PLANS
from app.services.report import build_pdf
from app.services.runner import create_pending_runs, execute_runs
from app.services.suggest import suggest_prompts

router = APIRouter(tags=["clients"])


def _client(db: Session, user: User, client_id: int) -> Client:
    c = db.get(Client, client_id)
    if not c or c.agency_id != user.agency_id:
        raise HTTPException(404, "Client not found")
    return c


def _prompt(db: Session, user: User, prompt_id: int) -> Prompt:
    p = db.get(Prompt, prompt_id)
    if not p:
        raise HTTPException(404, "Prompt not found")
    _client(db, user, p.client_id)
    return p


def _limits(user: User) -> dict:
    return PLANS[DEFAULT_PLAN]


def _clean_aliases(a: list[str]) -> list[str]:
    return [x.strip() for x in a if x and x.strip()]


@router.get("/plan")
def plan_usage(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lim = _limits(user)
    clients = db.scalar(select(func.count(Client.id)).where(Client.agency_id == user.agency_id)) or 0
    prompts = db.scalar(select(func.count(Prompt.id)).join(Client).where(Client.agency_id == user.agency_id)) or 0
    return {"plan": DEFAULT_PLAN, "limits": lim, "usage": {"clients": clients, "prompts": prompts}, "answers_today": usage_today(db, user.agency_id), "drafts_today": drafts_today(db, user.agency_id)}


# ---------- clients ----------
@router.get("/clients", response_model=list[ClientCard])
def list_clients(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    clients = db.scalars(select(Client).where(Client.agency_id == user.agency_id).order_by(Client.created_at.desc())).all()
    counts = dict(db.execute(select(Prompt.client_id, func.count(Prompt.id)).join(Client).where(Client.agency_id == user.agency_id).group_by(Prompt.client_id)).all())
    vis = metrics.visibility_by_client(db, user.agency_id, 30)
    out = []
    for c in clients:
        card = ClientCard.model_validate(c)
        card.prompt_count = counts.get(c.id, 0)
        card.visibility = vis.get(c.id)
        out.append(card)
    return out


@router.post("/clients", response_model=ClientOut, status_code=201)
def create_client(body: ClientIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.scalar(select(func.count(Client.id)).where(Client.agency_id == user.agency_id)) or 0
    if n >= _limits(user)["clients"]:
        raise HTTPException(402, f"Your plan allows {_limits(user)['clients']} clients.")
    c = Client(agency_id=user.agency_id, name=body.name.strip(), domain=body.domain, industry=body.industry, aliases=_clean_aliases(body.aliases))
    c.competitors = [Competitor(name=x.name.strip(), domain=x.domain, aliases=_clean_aliases(x.aliases)) for x in body.competitors]
    db.add(c)
    db.commit()
    return c


@router.get("/clients/{client_id}", response_model=ClientOut)
def get_client(client_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _client(db, user, client_id)


@router.patch("/clients/{client_id}", response_model=ClientOut)
def update_client(client_id: int, body: ClientUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _client(db, user, client_id)
    data = body.model_dump(exclude_unset=True)
    comps = data.pop("competitors", None)
    for k, v in data.items():
        setattr(c, k, _clean_aliases(v) if k == "aliases" else v)
    if comps is not None:
        c.competitors.clear()
        c.competitors.extend(Competitor(name=x["name"].strip(), domain=x.get("domain"), aliases=_clean_aliases(x.get("aliases", []))) for x in comps)
    db.commit()
    return c


@router.delete("/clients/{client_id}", status_code=204)
def delete_client(client_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_client(db, user, client_id))
    db.commit()


# ---------- prompts ----------
def _prompt_out(p: Prompt, stats: dict) -> PromptOut:
    out = PromptOut.model_validate(p)
    st = stats.get(p.id)
    if st:
        out.runs, out.visibility, out.avg_position, out.last_run = st["runs"], st["visibility"], st["avg_position"], st["last_run"]
    return out


@router.get("/clients/{client_id}/prompts", response_model=list[PromptOut])
def list_prompts(client_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _client(db, user, client_id)
    stats = metrics.prompt_stats(db, client_id)
    ps = db.scalars(select(Prompt).where(Prompt.client_id == client_id).order_by(Prompt.created_at.desc(), Prompt.id.desc())).all()
    return [_prompt_out(p, stats) for p in ps]


@router.post("/clients/{client_id}/prompts", response_model=list[PromptOut], status_code=201)
def add_prompts(client_id: int, body: PromptBulkIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _client(db, user, client_id)
    total = db.scalar(select(func.count(Prompt.id)).join(Client).where(Client.agency_id == user.agency_id)) or 0
    limit = _limits(user)["prompts"]
    existing = {t.lower() for t in db.scalars(select(Prompt.text).where(Prompt.client_id == client_id))}
    new = []
    for p in body.prompts:
        t = p.text.strip()
        if t.lower() in existing:
            continue
        existing.add(t.lower())
        new.append(Prompt(client_id=client_id, text=t, category=p.category))
    if total + len(new) > limit:
        raise HTTPException(402, f"Your plan allows {limit} prompts.")
    db.add_all(new)
    db.commit()
    return [_prompt_out(p, {}) for p in new]


@router.post("/clients/{client_id}/prompts/suggest")
def suggest(client_id: int, body: SuggestIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _client(db, user, client_id)
    return suggest_prompts(c, body.industry, body.count)


@router.patch("/prompts/{prompt_id}", response_model=PromptOut)
def update_prompt(prompt_id: int, body: PromptUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _prompt(db, user, prompt_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    return _prompt_out(p, {})


@router.delete("/prompts/{prompt_id}", status_code=204)
def delete_prompt(prompt_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_prompt(db, user, prompt_id))
    db.commit()


# ---------- runs ----------
@router.post("/prompts/{prompt_id}/run", status_code=202)
def run_prompt(prompt_id: int, bg: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _prompt(db, user, prompt_id)
    check_can_scan(db, user, p.client_id, [p])
    ids = create_pending_runs(db, p)
    bg.add_task(execute_runs, p.id, ids)
    return {"queued": len(ids), "prompts": 1, "engines": len(ids)}


@router.post("/clients/{client_id}/run", status_code=202)
def run_client(client_id: int, bg: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _client(db, user, client_id)
    prompts = db.scalars(select(Prompt).where(Prompt.client_id == client_id, Prompt.active.is_(True))).all()
    if not prompts:
        raise HTTPException(400, "Add at least one active prompt first")
    check_can_scan(db, user, client_id, list(prompts))
    n = 0
    for p in prompts:
        ids = create_pending_runs(db, p)
        bg.add_task(execute_runs, p.id, ids)
        n += len(ids)
    return {"queued": n, "prompts": len(prompts), "engines": len(ENGINE_NAMES)}


@router.get("/clients/{client_id}/scan")
def scan_status(client_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Live progress of the latest scan: totals, per-engine counts and a per-answer feed."""
    _client(db, user, client_id)
    cols = (Run.id, Run.prompt_id, Run.engine, Run.status, Run.is_mock, Run.brand_mentioned, Run.position, Run.sentiment, Run.latency_ms, Run.error, Run.created_at)
    rows = db.execute(select(*cols).where(Run.client_id == client_id).order_by(Run.created_at.desc(), Run.id.desc()).limit(600)).all()
    active = [r for r in rows if r.status in ACTIVE_STATUSES]
    modes = engine_modes()
    if not rows:
        return {"active": False, "total": 0, "engine_modes": modes}
    # A scan = the runs queued together: everything since the oldest still-active run, else the last minute of activity.
    since = min(r.created_at for r in active) if active else rows[0].created_at - timedelta(seconds=60)
    scan = [r for r in rows if r.created_at >= since]
    texts = dict(db.execute(select(Prompt.id, Prompt.text).where(Prompt.id.in_({r.prompt_id for r in scan}))).all())
    finished = [r for r in scan if r.status in ("done", "failed")]
    names: dict[int, list[dict]] = {}
    for rid, name, is_client in db.execute(select(Mention.run_id, Mention.name, Mention.is_client).where(Mention.run_id.in_([r.id for r in finished])).order_by(Mention.position)):
        names.setdefault(rid, []).append({"name": name, "is_client": is_client})

    def count(rs, st):
        return sum(1 for r in rs if r.status == st)

    engines = []
    for eng in ENGINE_NAMES:
        er = [r for r in scan if r.engine == eng]
        if er:
            done = [r for r in er if r.status == "done"]
            engines.append({"engine": eng, "mode": modes[eng], "total": len(er), "done": len(done), "failed": count(er, "failed"), "queued": count(er, "pending"), "running": count(er, "running"), "analyzing": count(er, "analyzing"),
                            "mentioned": sum(1 for r in done if r.brand_mentioned), "avg_latency_ms": int(sum(r.latency_ms for r in done) / len(done)) if done else None})
    done_rows = [r for r in scan if r.status == "done"]
    order = {"running": 0, "analyzing": 1, "pending": 2, "failed": 3, "done": 4}
    items = sorted(scan, key=lambda r: (order.get(r.status, 5), -r.id))[:80]
    return {
        "active": bool(active),
        "started_at": since if active else min(r.created_at for r in scan),
        "total": len(scan),
        "done": len(done_rows),
        "failed": count(scan, "failed"),
        "queued": count(scan, "pending"),
        "running": count(scan, "running"),
        "analyzing": count(scan, "analyzing"),
        "prompts": len({r.prompt_id for r in scan}),
        "mentioned": sum(1 for r in done_rows if r.brand_mentioned),
        "engines": engines,
        "engine_modes": modes,
        "max_concurrent": get_settings().max_concurrent_calls,
        "items": [{"id": r.id, "prompt_id": r.prompt_id, "prompt": texts.get(r.prompt_id, ""), "engine": r.engine, "status": r.status, "is_mock": r.is_mock, "brand_mentioned": r.brand_mentioned, "position": r.position,
                   "sentiment": r.sentiment, "latency_ms": r.latency_ms, "error": r.error, "brands": names.get(r.id, [])} for r in items],
    }


@router.get("/clients/{client_id}/runs", response_model=list[RunOut])
def list_runs(client_id: int, prompt_id: int | None = None, limit: int = Query(50, le=200), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _client(db, user, client_id)
    q = select(Run).options(lazyload(Run.mentions), lazyload(Run.citations)).where(Run.client_id == client_id).order_by(Run.created_at.desc(), Run.id.desc()).limit(limit)
    if prompt_id:
        q = q.where(Run.prompt_id == prompt_id)
    return db.scalars(q).all()


@router.get("/runs/{run_id}", response_model=RunDetail)
def get_run(run_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.get(Run, run_id)
    if not r:
        raise HTTPException(404, "Run not found")
    _client(db, user, r.client_id)
    return r


# ---------- analytics ----------
@router.get("/clients/{client_id}/overview")
def overview(client_id: int, days: int = Query(30, ge=1, le=365), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _client(db, user, client_id)
    return metrics.client_overview(db, client_id, days)


@router.get("/clients/{client_id}/gaps")
def gap_analysis(client_id: int, days: int = Query(30, ge=1, le=365), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Where competitors win instead of the client, which sources are cited there, and what to do about it."""
    return gaps.analyze(db, _client(db, user, client_id), days)


def _draft_out(d: Draft) -> dict:
    return {"id": d.id, "action_id": d.action_id, "content": d.content, "model": d.model, "created_at": d.created_at}


@router.get("/clients/{client_id}/drafts")
def list_drafts(client_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The latest saved draft for each action."""
    _client(db, user, client_id)
    latest: dict[str, Draft] = {}
    for d in db.scalars(select(Draft).where(Draft.client_id == client_id).order_by(Draft.created_at.desc(), Draft.id.desc())):
        latest.setdefault(d.action_id, d)
    return [_draft_out(d) for d in latest.values()]


@router.post("/clients/{client_id}/gaps/draft", status_code=201)
def draft_action(client_id: int, body: DraftIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Have Claude write the content for one action in the action plan."""
    c = _client(db, user, client_id)
    analysis = gaps.analyze(db, c, body.days)
    action = next((a for a in analysis.get("actions", []) if a["id"] == body.action_id), None)
    if not action:
        raise HTTPException(404, "That action is no longer in the plan. Refresh the page.")
    check_can_draft(db, user)
    try:
        text, model = call_claude(SYSTEM, build_prompt(c, action, body.facts))
    except DraftError as e:
        raise HTTPException(e.status, e.message) from None
    d = Draft(agency_id=user.agency_id, client_id=c.id, action_id=action["id"], content=text, model=model)
    db.add(d)
    db.commit()
    return _draft_out(d)


@router.get("/clients/{client_id}/report.pdf")
def report(client_id: int, days: int = Query(30, ge=1, le=365), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _client(db, user, client_id)
    ov = metrics.client_overview(db, client_id, days)
    stats = metrics.prompt_stats(db, client_id)
    rows = [{"text": p.text, **(stats.get(p.id) or {"runs": 0, "visibility": 0})} for p in db.scalars(select(Prompt).where(Prompt.client_id == client_id))]
    pdf = build_pdf(user.agency.name, user.agency.brand_color, c.name, ov, rows)
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{c.name}-ai-visibility.pdf"'})
