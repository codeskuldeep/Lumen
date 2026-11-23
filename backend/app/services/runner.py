"""Runs prompts against the AI engines.

All engine calls from every scan and every user go through ONE background event loop with shared
semaphores, so the number of calls in flight is capped for the whole server (and per engine) no matter
how many prompts or users start scans at once. Extra runs simply wait in the "pending" (queued) state.
"""

import asyncio
import logging
import threading
import time
from concurrent.futures import Future

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import ACTIVE_STATUSES, Citation, Client, Mention, Prompt, Run
from app.services.engines import ENGINE_NAMES, build_engines
from app.services.engines.base import Engine
from app.services.llm_parser import refine_sentiment
from app.services.parser import Brand, domain_of, find_mentions

log = logging.getLogger(__name__)

_loop: asyncio.AbstractEventLoop | None = None
_global_sem: asyncio.Semaphore | None = None
_engine_sems: dict[str, asyncio.Semaphore] = {}
_start_lock = threading.Lock()
_db_lock = threading.Lock()  # serialises the many small writes (SQLite allows one writer)


def _ensure_loop() -> asyncio.AbstractEventLoop:
    """Start (once) the shared event loop that owns every engine call and its limits."""
    global _loop, _global_sem
    with _start_lock:
        if _loop is None:
            s = get_settings()
            loop = asyncio.new_event_loop()
            _global_sem = asyncio.Semaphore(max(1, s.max_concurrent_calls))
            for name in ENGINE_NAMES:
                _engine_sems[name] = asyncio.Semaphore(max(1, s.max_calls_per_engine))
            threading.Thread(target=loop.run_forever, name="engine-loop", daemon=True).start()
            _loop = loop
        return _loop


def brands_for(client: Client) -> list[Brand]:
    out = [Brand(client.name, list(client.aliases or []) + ([client.domain] if client.domain else []), True)]
    out += [Brand(c.name, list(c.aliases or []) + ([c.domain] if c.domain else [])) for c in client.competitors]
    return out


def create_pending_runs(db: Session, prompt: Prompt, engines: list[str] | None = None) -> list[int]:
    ids = []
    for eng in engines or ENGINE_NAMES:
        r = Run(prompt_id=prompt.id, client_id=prompt.client_id, engine=eng, status="pending")
        db.add(r)
        db.flush()
        ids.append(r.id)
    db.commit()
    return ids


def _set_status(run_id: int, status: str) -> None:
    with _db_lock, SessionLocal() as db:
        db.execute(update(Run).where(Run.id == run_id, Run.status.in_(ACTIVE_STATUSES)).values(status=status))
        db.commit()


async def _execute(run_id: int, engine: Engine, prompt_text: str, brands: list[Brand]) -> None:
    assert _global_sem is not None
    # Waiting here (status stays "pending") is the queue: at most N calls in flight server-wide, M per engine.
    async with _global_sem, _engine_sems[engine.name]:
        t0 = time.perf_counter()
        ans, found, err = None, [], None
        try:
            await asyncio.to_thread(_set_status, run_id, "running")  # waiting for the engine's answer
            ans = await engine.run(prompt_text)
            await asyncio.to_thread(_set_status, run_id, "analyzing")  # finding brands, sentiment
            found = find_mentions(ans.text, brands)
            await refine_sentiment(ans.text, found)
        except Exception as e:  # noqa: BLE001 - record any engine failure
            ans, found, err = None, [], f"{type(e).__name__}: {e}"[:500]
        latency = int((time.perf_counter() - t0) * 1000)
    await asyncio.to_thread(_store, run_id, engine, ans, found, err, latency)  # saved the moment it finishes


def _store(run_id: int, engine: Engine, ans, found, err, latency):
    with _db_lock, SessionLocal() as db:
        run = db.get(Run, run_id)
        if not run:
            return
        run.latency_ms = latency
        if err or ans is None:
            run.status, run.error = "failed", err
        else:
            run.status, run.raw_response, run.cost_usd, run.is_mock = "done", ans.text, ans.cost_usd, engine.is_mock
            for f in found:
                db.add(Mention(run_id=run.id, name=f.name, is_client=f.is_client, position=f.position, sentiment=f.sentiment, snippet=f.snippet))
                if f.is_client:
                    run.brand_mentioned, run.position, run.sentiment = True, f.position, f.sentiment
            seen = set()
            for s in ans.sources:
                if s.url in seen:
                    continue
                seen.add(s.url)
                db.add(Citation(run_id=run.id, url=s.url[:1000], domain=domain_of(s.url)[:255], title=(s.title or None) and s.title[:500]))
        db.commit()


async def _run_many(run_ids: list[int], prompt_text: str, engines: dict[str, Engine], brands: list[Brand], names: dict[int, str], agency_id: int) -> None:
    await asyncio.gather(*[_execute(rid, engines[names[rid]], prompt_text, brands) for rid in run_ids])
    await asyncio.to_thread(_check_alerts, agency_id)


def execute_runs(prompt_id: int, run_ids: list[int]) -> None:
    """Hand a prompt's runs to the shared engine loop and return right away (it never blocks a web thread)."""
    with SessionLocal() as db:
        prompt = db.get(Prompt, prompt_id)
        if not prompt:
            return
        client = db.get(Client, prompt.client_id)
        brands = brands_for(client)
        agency_id = client.agency_id
        text = prompt.text
        runs = db.scalars(select(Run).where(Run.id.in_(run_ids))).all()
        names = {r.id: r.engine for r in runs}
    ids = list(names)
    try:
        engines = {e.name: e for e in build_engines([b.name for b in brands])}
        fut: Future = asyncio.run_coroutine_threadsafe(_run_many(ids, text, engines, brands, names, agency_id), _ensure_loop())
    except Exception as e:  # noqa: BLE001
        log.exception("could not start run batch")
        _fail_active(ids, f"{type(e).__name__}: {e}"[:500])
        return

    def _done(f: Future) -> None:
        if f.cancelled() or f.exception():
            log.error("run batch crashed", exc_info=f.exception())
            _fail_active(ids, f"Scan crashed: {f.exception()}"[:500])

    fut.add_done_callback(_done)


def _fail_active(run_ids: list[int], reason: str) -> None:
    with _db_lock, SessionLocal() as db:
        db.execute(update(Run).where(Run.id.in_(run_ids), Run.status.in_(ACTIVE_STATUSES)).values(status="failed", error=reason))
        db.commit()


def _check_alerts(agency_id: int) -> None:
    """After a manual scan, flag big week-over-week swings (deduped, so repeat calls are harmless)."""
    from app.services.alerts import run_alert_checks

    try:
        with SessionLocal() as db:
            if not db.scalar(select(Run.id).where(Run.status.in_(ACTIVE_STATUSES)).limit(1)):
                run_alert_checks(db, agency_id)
    except Exception:  # noqa: BLE001
        log.exception("alert check failed")


def recover_interrupted_runs() -> None:
    """Runs left in-flight by a server restart can never finish; mark them failed so the UI stops waiting."""
    with SessionLocal() as db:
        n = db.execute(update(Run).where(Run.status.in_(ACTIVE_STATUSES)).values(status="failed", error="Interrupted: the server restarted before this finished. Run the scan again.")).rowcount
        db.commit()
    if n:
        log.warning("marked %d interrupted runs as failed", n)
