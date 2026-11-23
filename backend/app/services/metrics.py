from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import ACTIVE_STATUSES, Citation, Client, Mention, Run


def _window(days: int, offset: int = 0):
    end = datetime.now(UTC) - timedelta(days=offset)
    return end - timedelta(days=days), end


def _base(client_id: int, start, end):
    return (Run.client_id == client_id, Run.status == "done", Run.created_at >= start, Run.created_at <= end)


def _summary(db: Session, client_id: int, start, end) -> dict:
    row = db.execute(
        select(
            func.count(Run.id),
            func.sum(case((Run.brand_mentioned, 1), else_=0)),
            func.avg(Run.position),
            func.avg(Run.sentiment),
        ).where(*_base(client_id, start, end))
    ).one()
    total, hit = row[0] or 0, int(row[1] or 0)
    mentions = db.execute(select(func.count(Mention.id), func.sum(case((Mention.is_client, 1), else_=0))).join(Run, Run.id == Mention.run_id).where(*_base(client_id, start, end))).one()
    all_m, client_m = mentions[0] or 0, int(mentions[1] or 0)
    return {
        "runs": total,
        "visibility": round(hit / total * 100, 1) if total else 0.0,
        "avg_position": round(row[2], 2) if row[2] else None,
        "sentiment": round(row[3], 2) if row[3] is not None else None,
        "share_of_voice": round(client_m / all_m * 100, 1) if all_m else 0.0,
    }


def client_overview(db: Session, client_id: int, days: int = 30) -> dict:
    start, end = _window(days)
    pstart, pend = _window(days, offset=days)
    cur, prev = _summary(db, client_id, start, end), _summary(db, client_id, pstart, pend)

    by_engine = [
        {
            "engine": e,
            "runs": n,
            "visibility": round((h or 0) / n * 100, 1) if n else 0.0,
            "avg_position": round(p, 2) if p else None,
        }
        for e, n, h, p in db.execute(
            select(Run.engine, func.count(Run.id), func.sum(case((Run.brand_mentioned, 1), else_=0)), func.avg(Run.position)).where(*_base(client_id, start, end)).group_by(Run.engine)
        )
    ]

    day = func.date(Run.created_at)
    trend = [
        {"date": str(d), "visibility": round((h or 0) / n * 100, 1), "runs": n}
        for d, n, h in db.execute(select(day, func.count(Run.id), func.sum(case((Run.brand_mentioned, 1), else_=0))).where(*_base(client_id, start, end)).group_by(day).order_by(day))
    ]

    rows = db.execute(
        select(Mention.name, Mention.is_client, func.count(Mention.id), func.avg(Mention.position), func.avg(Mention.sentiment))
        .join(Run, Run.id == Mention.run_id)
        .where(*_base(client_id, start, end))
        .group_by(Mention.name, Mention.is_client)
        .order_by(func.count(Mention.id).desc())
    ).all()
    total_m = sum(r[2] for r in rows) or 1
    brands = [
        {
            "name": n,
            "is_client": bool(ic),
            "mentions": c,
            "share": round(c / total_m * 100, 1),
            "avg_position": round(p, 2) if p else None,
            "sentiment": round(s, 2) if s is not None else None,
        }
        for n, ic, c, p, s in rows
    ]

    cites = [
        {"domain": d, "count": c}
        for d, c in db.execute(
            select(Citation.domain, func.count(Citation.id))
            .join(Run, Run.id == Citation.run_id)
            .where(*_base(client_id, start, end))
            .group_by(Citation.domain)
            .order_by(func.count(Citation.id).desc())
            .limit(10)
        )
    ]
    pending = db.scalar(select(func.count(Run.id)).where(Run.client_id == client_id, Run.status.in_(ACTIVE_STATUSES))) or 0
    cost = db.scalar(select(func.sum(Run.cost_usd)).where(*_base(client_id, start, end))) or 0.0
    has_mock = bool(db.scalar(select(func.count(Run.id)).where(*_base(client_id, start, end), Run.is_mock.is_(True))))
    return {
        "has_mock": has_mock,
        "days": days,
        "current": cur,
        "previous": prev,
        "by_engine": by_engine,
        "trend": trend,
        "brands": brands,
        "top_citations": cites,
        "pending_runs": pending,
        "cost_usd": round(cost, 4),
    }


def prompt_stats(db: Session, client_id: int) -> dict[int, dict]:
    rows = db.execute(
        select(Run.prompt_id, func.count(Run.id), func.sum(case((Run.brand_mentioned, 1), else_=0)), func.avg(Run.position), func.max(Run.created_at))
        .where(Run.client_id == client_id, Run.status == "done")
        .group_by(Run.prompt_id)
    )
    return {pid: {"runs": n, "visibility": round((h or 0) / n * 100, 1) if n else 0.0, "avg_position": round(p, 2) if p else None, "last_run": last} for pid, n, h, p, last in rows}


def visibility_by_client(db: Session, agency_id: int, days: int = 30) -> dict[int, float]:
    """Visibility % over the last `days` for every client of an agency, in one query."""
    start, end = _window(days)
    rows = db.execute(
        select(Run.client_id, func.count(Run.id), func.sum(case((Run.brand_mentioned, 1), else_=0)))
        .join(Client, Client.id == Run.client_id)
        .where(Client.agency_id == agency_id, Run.status == "done", Run.created_at >= start, Run.created_at <= end)
        .group_by(Run.client_id)
    )
    return {cid: round((hit or 0) / n * 100, 1) for cid, n, hit in rows if n}
