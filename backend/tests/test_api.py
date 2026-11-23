import time


def auth(client):
    r = client.post("/api/auth/signup", json={"agency_name": "Test Agency", "name": "T", "email": "t@x.com", "password": "password123"})
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_full_flow(client):
    h = auth(client)
    assert client.post("/api/auth/login", json={"email": "t@x.com", "password": "bad"}).status_code == 401
    c = client.post("/api/clients", headers=h, json={"name": "Acme", "industry": "CRM software", "competitors": [{"name": "Globex"}, {"name": "Initech"}]}).json()
    sug = client.post(f"/api/clients/{c['id']}/prompts/suggest", headers=h, json={"count": 10}).json()
    assert len(sug) == 10
    added = client.post(f"/api/clients/{c['id']}/prompts", headers=h, json={"prompts": sug}).json()
    assert len(added) == 10
    assert client.post(f"/api/clients/{c['id']}/run", headers=h).json()["queued"] == 20
    first = client.get(f"/api/clients/{c['id']}/scan", headers=h).json()
    assert first["total"] == 20 and {e["engine"] for e in first["engines"]} == {"chatgpt", "google_aio"}
    for _ in range(40):
        ov = client.get(f"/api/clients/{c['id']}/overview", headers=h).json()
        if ov["pending_runs"] == 0:
            break
        time.sleep(0.25)
    assert ov["pending_runs"] == 0 and ov["current"]["runs"] == 20
    scan = client.get(f"/api/clients/{c['id']}/scan", headers=h).json()
    assert scan["active"] is False and scan["done"] == 20 and scan["failed"] == 0 and scan["items"][0]["status"] == "done"
    card = client.get("/api/clients", headers=h).json()[0]
    assert card["visibility"] == ov["current"]["visibility"] and card["prompt_count"] == 10  # one grouped query matches the full overview
    assert len(ov["by_engine"]) == 2 and ov["brands"]
    assert client.get(f"/api/clients/{c['id']}/report.pdf", headers=h).content[:4] == b"%PDF"
    runs = client.get(f"/api/clients/{c['id']}/runs", headers=h).json()
    assert client.get(f"/api/runs/{runs[0]['id']}", headers=h).json()["raw_response"]


def test_tenant_isolation(client):
    h = auth(client)
    c = client.post("/api/clients", headers=h, json={"name": "Acme"}).json()
    r = client.post("/api/auth/signup", json={"agency_name": "Other", "name": "O", "email": "o@x.com", "password": "password123"})
    h2 = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get(f"/api/clients/{c['id']}", headers=h2).status_code == 404
    assert client.get("/api/clients", headers=h2).json() == []


def _client_with_prompts(client, h, n):
    c = client.post("/api/clients", headers=h, json={"name": "Acme"}).json()
    client.post(f"/api/clients/{c['id']}/prompts", headers=h, json={"prompts": [{"text": f"best crm {i}"} for i in range(n)]})
    return c["id"]


def _wait(client, h, cid):
    for _ in range(200):
        if not client.get(f"/api/clients/{cid}/scan", headers=h).json()["active"]:
            return
        time.sleep(0.05)
    raise AssertionError("scan did not finish")


def test_scan_wide_concurrency_cap(client, monkeypatch):
    from app.services.engines.mock import MockEngine

    state = {"now": 0, "max": 0}
    orig = MockEngine.run

    async def spy(self, prompt):
        state["now"] += 1
        state["max"] = max(state["max"], state["now"])
        try:
            return await orig(self, prompt)
        finally:
            state["now"] -= 1

    monkeypatch.setattr(MockEngine, "run", spy)
    h = auth(client)
    cid = _client_with_prompts(client, h, 8)  # 16 calls queued at once
    assert client.post(f"/api/clients/{cid}/run", headers=h).json()["queued"] == 16
    _wait(client, h, cid)
    assert client.get(f"/api/clients/{cid}/scan", headers=h).json()["done"] == 16
    assert 1 < state["max"] <= 3  # MAX_CONCURRENT_CALLS=3 in conftest


def test_second_scan_blocked_while_running(client):
    h = auth(client)
    cid = _client_with_prompts(client, h, 8)
    assert client.post(f"/api/clients/{cid}/run", headers=h).status_code == 202
    r = client.post(f"/api/clients/{cid}/run", headers=h)
    assert r.status_code == 409 and "already running" in r.json()["detail"]
    _wait(client, h, cid)


def test_daily_limit_and_rate_limit(client, monkeypatch):
    from app.services import limits

    monkeypatch.setattr(limits, "engine_modes", lambda: {"chatgpt": "live", "google_aio": "live"})
    monkeypatch.setenv("DAILY_ANSWER_LIMIT", "20")
    from app.core.config import get_settings

    get_settings().daily_answer_limit = 20
    h = auth(client)
    cid = _client_with_prompts(client, h, 11)  # needs 22 live answers > 20
    r = client.post(f"/api/clients/{cid}/run", headers=h)
    assert r.status_code == 429 and "Daily limit" in r.json()["detail"]
    assert client.get("/api/plan", headers=h).json()["answers_today"]["limit"] == 20
    get_settings().scan_starts_per_minute = 2
    limits._hits.clear()
    last = [client.post(f"/api/clients/{cid}/run", headers=h) for _ in range(3)][-1]
    assert last.status_code == 429 and "too fast" in last.json()["detail"]
    get_settings().daily_answer_limit = 500
    get_settings().scan_starts_per_minute = 6


def test_gap_analysis(client):
    h = auth(client)
    c = client.post("/api/clients", headers=h, json={"name": "Acme", "domain": "acme.com", "industry": "CRM software", "competitors": [{"name": "Globex"}, {"name": "Initech"}]}).json()
    assert client.get(f"/api/clients/{c['id']}/gaps", headers=h).json() == {"has_data": False, "days": 30}
    sug = client.post(f"/api/clients/{c['id']}/prompts/suggest", headers=h, json={"count": 14}).json()
    client.post(f"/api/clients/{c['id']}/prompts", headers=h, json={"prompts": sug})
    client.post(f"/api/clients/{c['id']}/run", headers=h)
    _wait(client, h, c["id"])
    g = client.get(f"/api/clients/{c['id']}/gaps", headers=h).json()
    assert g["has_data"] and g["has_mock"] and g["summary"]["answers"] == 28
    assert g["actions"] and all({"id", "priority", "title", "why", "steps", "impact"} <= set(a) for a in g["actions"])
    assert [a["priority"] for a in g["actions"]] == sorted((a["priority"] for a in g["actions"]), key={"high": 0, "medium": 1, "low": 2}.get)
    assert g["competitors"] and g["engines"] and "prompt_gaps" in g


def test_gap_actions_from_known_data(client):
    from app.core.db import SessionLocal
    from app.models import Citation, Mention, Run

    h = auth(client)
    c = client.post("/api/clients", headers=h, json={"name": "Acme", "domain": "acme.com", "competitors": [{"name": "Globex"}]}).json()
    pid = client.post(f"/api/clients/{c['id']}/prompts", headers=h, json={"prompts": [{"text": "Acme vs Globex", "category": "comparison"}, {"text": "best crm"}]}).json()
    with SessionLocal() as db:
        for p in pid:
            for eng in ("chatgpt", "google_aio"):
                r = Run(prompt_id=p["id"], client_id=c["id"], engine=eng, status="done", is_mock=False, brand_mentioned=False)
                db.add(r)
                db.flush()
                db.add(Mention(run_id=r.id, name="Globex", is_client=False, position=1, sentiment=0.2))
                db.add(Citation(run_id=r.id, url="https://www.g2.com/products/globex", domain="g2.com", title="Globex reviews"))
        db.commit()
    g = client.get(f"/api/clients/{c['id']}/gaps", headers=h).json()
    assert g["summary"]["losing_pct"] == 100 and g["summary"]["top_competitor"] == "Globex" and not g["has_mock"]
    assert g["source_gaps"][0]["domain"] == "g2.com" and g["source_gaps"][0]["category"] == "review" and g["source_gaps"][0]["gap_answers"] == 4
    ids = {a["id"] for a in g["actions"]}
    assert {"source:g2.com", "own-site", "content:invisible", "content:comparison"} <= ids
    assert g["actions"][0]["priority"] == "high" and len(g["prompt_gaps"]) == 2


def test_drafting(client, monkeypatch):
    from app.api import clients as api_clients
    from app.core.config import get_settings
    from app.services import drafts

    h = auth(client)
    c = client.post("/api/clients", headers=h, json={"name": "Acme", "domain": "acme.com", "competitors": [{"name": "Globex"}]}).json()
    cid = c["id"]
    client.post(f"/api/clients/{cid}/prompts", headers=h, json={"prompts": [{"text": "best crm"}]})
    client.post(f"/api/clients/{cid}/run", headers=h)
    _wait(client, h, cid)
    g = client.get(f"/api/clients/{cid}/gaps", headers=h).json()
    aid = g["actions"][0]["id"]

    # no Anthropic key -> clear 503, nothing saved
    get_settings().anthropic_api_key = ""
    r = client.post(f"/api/clients/{cid}/gaps/draft", headers=h, json={"action_id": aid})
    assert r.status_code == 503 and "ANTHROPIC_API_KEY" in r.json()["detail"]
    assert client.get("/api/plan", headers=h).json()["drafts_today"]["enabled"] is False

    seen = {}

    def fake(system, prompt):
        seen["prompt"], seen["system"] = prompt, system
        return "# Draft\n[PLACEHOLDER: price]", "test-model"

    monkeypatch.setattr(api_clients, "call_claude", fake)
    r = client.post(f"/api/clients/{cid}/gaps/draft", headers=h, json={"action_id": aid, "facts": "Acme sells CRM to dentists."})
    assert r.status_code == 201 and r.json()["content"].startswith("# Draft")
    assert "Acme sells CRM to dentists." in seen["prompt"] and "Acme" in seen["prompt"] and "NEVER invent facts" in seen["system"]
    assert client.post(f"/api/clients/{cid}/gaps/draft", headers=h, json={"action_id": "nope"}).status_code == 404
    saved = client.get(f"/api/clients/{cid}/drafts", headers=h).json()
    assert len(saved) == 1 and saved[0]["action_id"] == aid
    get_settings().daily_draft_limit = 1
    limits_r = client.post(f"/api/clients/{cid}/gaps/draft", headers=h, json={"action_id": aid})
    get_settings().daily_draft_limit = 30
    assert limits_r.status_code == 429 and "Daily drafting limit" in limits_r.json()["detail"]
    assert drafts.build_prompt  # prompt builder is importable


def test_call_claude_error_mapping(monkeypatch):
    import httpx

    from app.core.config import get_settings
    from app.services import drafts

    get_settings().anthropic_api_key = "k"
    for status, expect in ((401, 502), (429, 429), (500, 502)):
        monkeypatch.setattr(drafts.httpx, "post", lambda *a, _s=status, **k: httpx.Response(_s, json={}, request=httpx.Request("POST", "http://x")))
        try:
            drafts.call_claude("s", "p")
        except drafts.DraftError as e:
            assert e.status == expect
        else:
            raise AssertionError("expected DraftError")
    ok = {"content": [{"type": "text", "text": "hi"}], "stop_reason": "end_turn"}
    monkeypatch.setattr(drafts.httpx, "post", lambda *a, **k: httpx.Response(200, json=ok, request=httpx.Request("POST", "http://x")))
    assert drafts.call_claude("s", "p")[0] == "hi"
    get_settings().anthropic_api_key = ""
