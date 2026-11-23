"""Optional LLM sentiment refinement. Falls back silently to the lexicon score on any failure."""

import json
import logging

import httpx

from app.core.config import get_settings
from app.services.parser import FoundMention

log = logging.getLogger(__name__)


async def refine_sentiment(text: str, found: list[FoundMention]) -> None:
    s = get_settings()
    # Paid call only when the client is in the answer: that is the sentiment we report. Others keep the free word-list score.
    if not s.anthropic_api_key or not any(f.is_client for f in found):
        return
    names = [f.name for f in found]
    prompt = (
        "Below is an AI assistant's answer. For each brand listed, rate how favourably the answer portrays it "
        "from -1 (clearly negative) to 1 (clearly positive); 0 is neutral or merely listed.\n"
        f"Brands: {json.dumps(names)}\n\nAnswer:\n{text[:6000]}\n\n"
        'Reply with ONLY a JSON object mapping each brand to its score, e.g. {"Acme": 0.6}.'
    )
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": s.anthropic_api_key, "anthropic-version": "2023-06-01"},
                json={"model": s.parser_model, "max_tokens": 300, "messages": [{"role": "user", "content": prompt}]},
            )
            r.raise_for_status()
            raw = r.json()["content"][0]["text"]
        scores = json.loads(raw[raw.index("{") : raw.rindex("}") + 1])
        for f in found:
            if f.name in scores:
                f.sentiment = max(-1.0, min(1.0, float(scores[f.name])))
    except Exception:  # noqa: BLE001
        log.warning("LLM sentiment refinement failed; using lexicon scores", exc_info=True)
