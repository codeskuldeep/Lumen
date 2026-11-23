import asyncio
import hashlib
import random

from app.services.engines.base import Engine, RawAnswer, Source

DOMAINS = ["reddit.com", "g2.com", "capterra.com", "forbes.com", "techradar.com", "wikipedia.org", "trustpilot.com", "medium.com"]


class MockEngine(Engine):
    """Deterministic-ish fake engine so the whole product works without API keys.

    The brand list is injected via the prompt text by the runner (see runner.py)."""

    is_mock = True

    def __init__(self, name: str, brands: list[str]):
        self.name = name
        self.brands = brands

    async def run(self, prompt: str) -> RawAnswer:
        await asyncio.sleep(random.uniform(0.05, 0.3))
        seed = int(hashlib.md5(f"{self.name}{prompt}{random.random()}".encode()).hexdigest()[:8], 16)
        rng = random.Random(seed)
        pool = self.brands[:]
        rng.shuffle(pool)
        # brands[0] is the client; leave it out of ~45% of answers so demo data looks realistic
        if pool and rng.random() < 0.45:
            pool = [b for b in pool if b != self.brands[0]] or pool
        chosen = pool[: rng.randint(1, max(1, min(4, len(pool))))] if pool else []
        adjectives = ["a strong choice", "widely recommended", "known for reliability", "a bit pricey but solid", "praised by users"]
        lines = [f"Here are some options worth considering for: {prompt}\n"]
        for i, b in enumerate(chosen, 1):
            lines.append(f"{i}. **{b}** is {rng.choice(adjectives)}.")
        lines.append("\nAlways compare features and pricing before deciding.")
        sources = [Source(f"https://{rng.choice(DOMAINS)}/{rng.randint(1000, 9999)}", "Source article") for _ in range(rng.randint(2, 5))]
        return RawAnswer("\n".join(lines), sources, cost_usd=0.0)
