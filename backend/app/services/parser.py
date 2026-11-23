import re
from dataclasses import dataclass
from urllib.parse import urlparse

POS = {"best", "great", "excellent", "recommended", "recommend", "reliable", "strong", "praised", "leading", "top", "popular", "solid", "trusted", "love", "fast", "easy", "affordable", "powerful"}
NEG = {"worst", "poor", "bad", "expensive", "pricey", "slow", "complaints", "avoid", "unreliable", "limited", "difficult", "buggy", "lacking", "overpriced", "confusing"}


@dataclass
class Brand:
    name: str
    aliases: list[str]
    is_client: bool = False


@dataclass
class FoundMention:
    name: str
    is_client: bool
    position: int
    sentiment: float
    snippet: str


def _pattern(brand: Brand) -> re.Pattern:
    terms = sorted({brand.name, *brand.aliases}, key=len, reverse=True)
    terms = [t.strip() for t in terms if t and t.strip()]
    return re.compile(r"(?<!\w)(?:" + "|".join(re.escape(t) for t in terms) + r")(?!\w)", re.I)


def _sentiment(sentence: str) -> float:
    words = re.findall(r"[a-z']+", sentence.lower())
    if not words:
        return 0.0
    score = sum(w in POS for w in words) - sum(w in NEG for w in words)
    return max(-1.0, min(1.0, score / 3))


def _sentence_around(text: str, start: int, end: int) -> str:
    left = max(text.rfind(".", 0, start), text.rfind("\n", 0, start))
    right_candidates = [i for i in (text.find(".", end), text.find("\n", end)) if i != -1]
    right = min(right_candidates) if right_candidates else len(text)
    return text[left + 1 : right + 1].strip(" -*#\n")[:400]


def find_mentions(text: str, brands: list[Brand]) -> list[FoundMention]:
    """Brands ranked by order of first appearance in the answer (position 1 = first)."""
    hits = []
    for b in brands:
        m = _pattern(b).search(text)
        if m:
            hits.append((m.start(), m.end(), b))
    hits.sort(key=lambda h: h[0])
    out = []
    for rank, (s, e, b) in enumerate(hits, 1):
        sent = _sentence_around(text, s, e)
        out.append(FoundMention(b.name, b.is_client, rank, _sentiment(sent), sent))
    return out


def domain_of(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host
