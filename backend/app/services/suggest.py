from datetime import date

from app.models import Client


def suggest_prompts(client: Client, industry: str | None, count: int) -> list[dict]:
    ind = (industry or client.industry or "").strip()
    name = client.name
    yr = date.today().year
    out: list[tuple[str, str]] = []
    if ind:
        out += [
            (f"What are the best {ind} companies?", "discovery"),
            (f"Top {ind} providers in {yr}", "discovery"),
            (f"Who is the most trusted {ind} brand?", "discovery"),
            (f"How do I choose a {ind} provider?", "research"),
            (f"Best affordable {ind} options", "pricing"),
            (f"Best {ind} for small businesses", "segment"),
            (f"Best {ind} for enterprises", "segment"),
            (f"{ind} recommendations from real users", "reviews"),
        ]
    out += [
        (f"Is {name} any good?", "brand"),
        (f"{name} reviews", "reviews"),
        (f"{name} pricing", "pricing"),
        (f"{name} alternatives", "comparison"),
        (f"Is {name} worth it?", "brand"),
        (f"What is {name} known for?", "brand"),
    ]
    for c in client.competitors:
        out += [(f"{name} vs {c.name}", "comparison"), (f"Is {c.name} better than {name}?", "comparison"), (f"{c.name} alternatives", "comparison")]
    seen, res = set(), []
    for text, cat in out:
        if text not in seen:
            seen.add(text)
            res.append({"text": text, "category": cat})
    return res[:count]
