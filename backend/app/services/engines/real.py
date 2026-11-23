import httpx

from app.core.config import get_settings
from app.services.engines.base import Engine, RawAnswer, Source

TIMEOUT = httpx.Timeout(180.0, connect=10.0)  # ChatGPT with web search can take ~1 minute


def _check(r: httpx.Response) -> None:
    """Like raise_for_status, but keeps the provider's own message so users see why a call failed."""
    if r.is_success:
        return
    try:
        err = r.json().get("error")
        msg = err.get("message") if isinstance(err, dict) else err
    except ValueError:
        msg = None
    raise RuntimeError(f"{r.status_code} {str(msg or r.reason_phrase)[:300]}")


class ChatGPTEngine(Engine):
    name = "chatgpt"

    async def run(self, prompt: str) -> RawAnswer:
        s = get_settings()
        body: dict = {"model": s.openai_model, "input": prompt, "tools": [{"type": "web_search"}]}
        if s.openai_reasoning_effort:
            body["reasoning"] = {"effort": s.openai_reasoning_effort}
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {s.openai_api_key}"},
                json=body,
            )
            _check(r)
            data = r.json()
        text, sources = "", []
        for item in data.get("output", []):
            if item.get("type") == "message":
                for part in item.get("content", []):
                    text += part.get("text", "")
                    for a in part.get("annotations", []):
                        if a.get("type") == "url_citation":
                            sources.append(Source(a["url"], a.get("title")))
        return RawAnswer(text, sources, cost_usd=0.035)


class GoogleAIOEngine(Engine):
    name = "google_aio"

    async def run(self, prompt: str) -> RawAnswer:
        s = get_settings()
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.get(
                "https://serpapi.com/search.json",
                params={"engine": "google", "q": prompt, "api_key": s.serpapi_api_key, "hl": "en", "gl": "us"},
            )
            _check(r)
            data = r.json()
            aio = data.get("ai_overview") or {}
            # AI Overview is sometimes delivered via a follow-up token request.
            if aio.get("page_token") and not aio.get("text_blocks"):
                r2 = await c.get(
                    "https://serpapi.com/search.json",
                    params={"engine": "google_ai_overview", "page_token": aio["page_token"], "api_key": s.serpapi_api_key},
                )
                _check(r2)
                aio = r2.json().get("ai_overview") or {}
        parts: list[str] = []
        for b in aio.get("text_blocks", []):
            if b.get("snippet"):
                parts.append(b["snippet"])
            for li in b.get("list", []) or []:
                parts.append("- " + (li.get("title", "") + " " + li.get("snippet", "")).strip())
        sources = [Source(x["link"], x.get("title")) for x in aio.get("references", []) if x.get("link")]
        return RawAnswer("\n".join(parts), sources, cost_usd=0.015)
