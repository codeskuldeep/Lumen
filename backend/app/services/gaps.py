"""Gap analysis: where competitors are recommended instead of the client, which sources the AI cites there,
and a prioritised list of actions that would improve the client's visibility. Pure analysis of saved runs
(no AI calls, no cost)."""

import re
from collections import Counter, defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Citation, Client, Mention, Prompt, Run
from app.services.metrics import _base, _window

CATEGORIES: dict[str, set[str]] = {
    "review": {"g2.com", "capterra.com", "trustpilot.com", "softwareadvice.com", "getapp.com", "trustradius.com", "sitejabber.com", "yelp.com", "tripadvisor.com", "producthunt.com", "clutch.co", "glassdoor.com", "bbb.org"},
    "community": {"reddit.com", "quora.com", "stackoverflow.com", "stackexchange.com", "news.ycombinator.com"},
    "reference": {"wikipedia.org", "wikidata.org", "britannica.com", "crunchbase.com"},
    "news": {"forbes.com", "techcrunch.com", "techradar.com", "cnet.com", "theverge.com", "businessinsider.com", "nytimes.com", "wsj.com", "bloomberg.com", "reuters.com", "pcmag.com", "zdnet.com", "wired.com", "inc.com", "entrepreneur.com", "fortune.com"},
    "social": {"linkedin.com", "facebook.com", "x.com", "twitter.com", "instagram.com", "youtube.com", "tiktok.com"},
}
CATEGORY_LABEL = {"review": "Review site", "community": "Community", "reference": "Reference", "news": "News / media", "social": "Social / video", "article": "Article / blog"}
ENGINE_TIPS = {
    "chatgpt": "ChatGPT's search tends to favour pages that are indexed by Bing and mentioned by well-known sources. Submit the site to Bing Webmaster Tools, make sure robots.txt allows OAI-SearchBot, and earn mentions on the sites it cites above.",
    "google_aio": "Google AI Overviews are built from pages that already rank well in Google. Improve rankings for the target questions, use structured data, and answer each question in the first two sentences of the page.",
}
PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


def category_of(domain: str) -> str:
    d = domain.lower().removeprefix("www.")
    for cat, doms in CATEGORIES.items():
        if any(d == x or d.endswith("." + x) for x in doms):
            return cat
    return "article"


def _norm(domain: str | None) -> str:
    return re.sub(r"^https?://|^www\.|/.*$", "", (domain or "").strip().lower())


def _is(domain: str, other: str) -> bool:
    return bool(other) and (domain == other or domain.endswith("." + other))


def _source_steps(domain: str, cat: str) -> list[str]:
    if cat == "review":
        return [f"Create or claim the client's profile on {domain} and fill in every field (category, description, pricing, screenshots).", "Ask 5-10 real customers for honest reviews there.", "Use exactly the same brand name and description as on the website."]
    if cat == "community":
        return [f"Find the {domain} threads the AI cites for these prompts (links below).", "Have a real team member answer helpfully and disclose the affiliation. No fake accounts and no pasted promotional links; communities remove them.", "Where the brand is already discussed, correct outdated or wrong facts politely."]
    if cat == "reference":
        return [f"Check whether the brand qualifies for a {domain} entry (they require independent coverage).", "Add or correct the facts, each backed by a reliable independent source.", "Keep name, founding date, category and website consistent with the rest of the web."]
    if cat == "news":
        return [f"Pitch {domain} a data-backed story or expert comment relevant to these questions.", "Aim to be included in their 'best X' and comparison roundups, not just a one-off press release.", "Link the coverage from the client's own site so it is easy to find."]
    if cat == "social":
        return [f"Publish helpful content on {domain} that answers these prompts (how-to, comparison, customer story).", "Use the brand name and category in titles and descriptions.", "Keep the profile complete and consistent with the website."]
    return [f"Open the pages from {domain} that the AI cites (links below) and see why the client isn't in them.", "Ask for inclusion or a correction: outreach to the author, a guest article, or a clearly labelled sponsored review.", "Give them easy facts to quote: pricing, features, who it's for, and a comparison table."]


def analyze(db: Session, client: Client, days: int = 30) -> dict:
    start, end = _window(days)
    base = _base(client.id, start, end)
    runs = db.execute(select(Run.id, Run.prompt_id, Run.engine, Run.brand_mentioned, Run.sentiment, Run.is_mock).where(*base)).all()
    if not runs:
        return {"has_data": False, "days": days}

    ment: dict[int, list[tuple[str, bool]]] = defaultdict(list)
    for rid, name, is_client in db.execute(select(Mention.run_id, Mention.name, Mention.is_client).join(Run, Run.id == Mention.run_id).where(*base)):
        ment[rid].append((name, bool(is_client)))
    cites: dict[int, dict[str, tuple[str, str | None]]] = defaultdict(dict)
    for rid, dom, url, title in db.execute(select(Citation.run_id, Citation.domain, Citation.url, Citation.title).join(Run, Run.id == Citation.run_id).where(*base)):
        cites[rid].setdefault(dom.lower().removeprefix("www."), (url, title))
    prompts = {p.id: p for p in db.scalars(select(Prompt).where(Prompt.client_id == client.id))}

    own = _norm(client.domain)
    comp_domains = {_norm(c.domain) for c in client.competitors if c.domain}
    total = len(runs)
    losing = [r for r in runs if not r.brand_mentioned and any(not ic for _, ic in ment[r.id])]  # a competitor was recommended instead

    # ---------- per prompt ----------
    by_prompt: dict[int, list] = defaultdict(list)
    for r in runs:
        by_prompt[r.prompt_id].append(r)
    prompt_rows = []
    for pid, rs in by_prompt.items():
        p = prompts.get(pid)
        if not p:
            continue
        hit = sum(1 for r in rs if r.brand_mentioned)
        vis = round(hit / len(rs) * 100)
        miss = [r for r in rs if not r.brand_mentioned]
        comps = Counter(n for r in miss for n, ic in ment[r.id] if not ic)
        engines_missing = sorted({e for e in {r.engine for r in rs} if not any(r.brand_mentioned for r in rs if r.engine == e)})
        doms = Counter(d for r in miss for d in cites[r.id])
        prompt_rows.append({"prompt_id": pid, "text": p.text, "category": p.category, "runs": len(rs), "visibility": vis, "missing_runs": len(miss),
                            "competitors": [{"name": n, "count": c} for n, c in comps.most_common(4)], "engines_missing": engines_missing, "top_sources": [d for d, _ in doms.most_common(3)]})
    gaps = sorted((p for p in prompt_rows if p["visibility"] < 50), key=lambda p: (p["visibility"], -sum(c["count"] for c in p["competitors"])))
    invisible = [p for p in gaps if p["visibility"] == 0]

    # ---------- sources the AI cites where the client loses ----------
    gap_cnt: Counter = Counter()
    present_cnt: Counter = Counter()
    sample: dict[str, list[dict]] = defaultdict(list)
    sample_prompts: dict[str, set[int]] = defaultdict(set)
    for r in runs:
        if r.brand_mentioned:
            present_cnt.update(cites[r.id].keys())
    for r in losing:
        for dom, (url, title) in cites[r.id].items():
            gap_cnt[dom] += 1
            sample_prompts[dom].add(r.prompt_id)
            if len(sample[dom]) < 3 and all(s["url"] != url for s in sample[dom]):
                sample[dom].append({"url": url, "title": title})
    min_hits = 2 if len(losing) >= 10 else 1
    sources = []
    for dom, n in gap_cnt.most_common():
        if n < min_hits or _is(dom, own) or any(_is(dom, c) for c in comp_domains if c):
            continue
        cat = category_of(dom)
        sources.append({"domain": dom, "category": cat, "category_label": CATEGORY_LABEL[cat], "gap_answers": n, "client_answers": present_cnt[dom], "examples": sample[dom],
                        "prompts": [prompts[i].text for i in list(sample_prompts[dom])[:4] if i in prompts]})
        if len(sources) >= 12:
            break

    # ---------- competitors that win the lost answers ----------
    comp_wins: Counter = Counter(n for r in losing for n, ic in ment[r.id] if not ic)
    comp_sources: dict[str, Counter] = defaultdict(Counter)
    for r in losing:
        for n, ic in ment[r.id]:
            if not ic:
                comp_sources[n].update(d for d in cites[r.id] if not _is(d, own))
    competitors = [{"name": n, "answers": c, "top_sources": [d for d, _ in comp_sources[n].most_common(4)]} for n, c in comp_wins.most_common(5)]

    # ---------- engines ----------
    overall = sum(1 for r in runs if r.brand_mentioned) / total * 100
    engines = []
    for e in sorted({r.engine for r in runs}):
        er = [r for r in runs if r.engine == e]
        v = sum(1 for r in er if r.brand_mentioned) / len(er) * 100
        engines.append({"engine": e, "runs": len(er), "visibility": round(v, 1), "vs_overall": round(v - overall, 1)})

    # ---------- actions ----------
    actions: list[dict] = []
    total_cited = sum(1 for r in runs if cites[r.id])

    def add(id_, priority, kind, title, why, steps, impact, **evidence):
        actions.append({"id": id_, "priority": priority, "kind": kind, "title": title, "why": why, "steps": steps, "impact": impact, "evidence": {k: v for k, v in evidence.items() if v}})

    for i, s in enumerate(sources[:5]):
        share = s["gap_answers"] / max(1, len(losing))
        add(f"source:{s['domain']}", "high" if i < 2 or share >= 0.25 else "medium", "source", f"Get the brand into {s['domain']}",
            f"{s['domain']} is cited in {s['gap_answers']} answers where a competitor was recommended instead of the client" + (f" (and in {s['client_answers']} where the client was)." if s["client_answers"] else ", and never in an answer that mentions the client."),
            _source_steps(s["domain"], s["category"]), s["gap_answers"], domains=[s["domain"]], pages=s["examples"], prompts=s["prompts"])

    if own and total_cited and not any(_is(d, own) for r in runs for d in cites[r.id]):
        add("own-site", "high", "content", "The client's own website is never cited",
            f"None of the {total_cited} answers with sources cite {own}. AI engines can't recommend what they don't find or trust.",
            ["Check robots.txt and firewalls aren't blocking OAI-SearchBot or Googlebot.", "Publish a page for each question the client should win (see the content action), with a direct answer in the first two sentences.", "Add structured data (Organization, Product, FAQ) and keep the About, Pricing and Features pages factual and current.", "Get pages indexed: Google Search Console and Bing Webmaster Tools."],
            len(losing), domains=[own])
    elif not own:
        add("no-domain", "low", "setup", "Add the client's website in Settings", "Without the domain we can't tell whether AI engines cite the client's own site.", ["Open the Settings tab and enter the client's domain, then run a scan again."], 0)

    if invisible:
        n_ans = sum(p["runs"] for p in invisible)
        add("content:invisible", "high" if len(invisible) >= 3 or len(invisible) / len(prompt_rows) >= 0.3 else "medium", "content", f"Create content for {len(invisible)} questions where the brand is never mentioned",
            f"For these prompts the client appeared in 0 of {n_ans} answers.",
            ["Publish one dedicated page per question. Put a direct answer in the first two sentences, then supporting facts, pricing and a comparison table.", "Add an FAQ section with schema markup and a visible 'last updated' date.", "Link to these pages from the homepage and relevant blog posts so crawlers find them.", "Re-run the scan in a few weeks; AI answers take time to pick up new pages."],
            n_ans, prompts=[p["text"] for p in invisible[:8]], competitors=[c["name"] for c in competitors[:3]])

    cmp_gaps = [p for p in gaps if (p["category"] == "comparison" or re.search(r"\bvs\.?\b|alternatives?|compare", p["text"], re.I))]
    if cmp_gaps:
        add("content:comparison", "high" if len(cmp_gaps) >= 2 else "medium", "content", "Publish comparison and 'alternatives' pages",
            f"The client is missing from {len(cmp_gaps)} head-to-head or alternatives questions, which are high-intent.",
            ["Write an honest 'X vs Y' page for each main competitor with a feature table, pricing, and who each is best for.", "Write an 'Alternatives to <competitor>' page that includes the client.", "Keep claims verifiable; AI engines skip pages that read as pure marketing."],
            sum(p["runs"] for p in cmp_gaps), prompts=[p["text"] for p in cmp_gaps[:6]])

    basics = [p for p in gaps if p["category"] in ("brand", "reviews", "pricing") and p not in cmp_gaps]
    if basics:
        add("brand:basics", "high", "brand", "Fix the basics: AI doesn't reliably know the brand",
            f"On {len(basics)} questions directly about the brand (reviews, pricing, what it is) the client is mentioned in under half of the answers. These should be near 100%.",
            ["Make the name, one-line description, category and website identical on the site, LinkedIn, directories and review profiles.", "Publish clear About, Pricing and 'What is <brand>?' pages with plain facts.", "Add Organization schema markup and sameAs links to all official profiles."],
            sum(p["runs"] for p in basics), prompts=[p["text"] for p in basics[:6]])

    weak = [e for e in engines if e["runs"] >= 4 and e["vs_overall"] <= -15]
    for e in sorted(weak, key=lambda e: e["vs_overall"])[:2]:
        add(f"engine:{e['engine']}", "medium", "engine", f"Improve visibility on {e['engine'].replace('_', ' ').title()}",
            f"The client is mentioned in {e['visibility']}% of answers there, {abs(e['vs_overall'])} points below its average.", [ENGINE_TIPS.get(e["engine"], "Check which sources this engine cites and match them.")], e["runs"], engines=[e["engine"]])

    sents = [r.sentiment for r in runs if r.brand_mentioned and r.sentiment is not None]
    if len(sents) >= 3 and sum(sents) / len(sents) < -0.1:
        add("sentiment", "medium", "brand", "Answers describe the brand negatively",
            f"Average sentiment across {len(sents)} mentions is {sum(sents) / len(sents):+.2f}.",
            ["Open the Answers tab and read the answers with negative wording to see the criticism (price, support, reliability).", "Address the root cause on the site: a transparent pricing page, support and SLA details, and case studies.", "Respond to critical reviews on the review sites listed above."], len(sents))

    if competitors and competitors[0]["answers"] >= 3:
        c = competitors[0]
        add(f"competitor:{c['name']}", "low", "competitor", f"Study what {c['name']} is doing",
            f"{c['name']} is recommended in {c['answers']} of the {len(losing)} answers the client loses.",
            [f"Look at how {c['name']} appears on the sources below and match that coverage.", "Compare its pages with the client's for the same questions: what facts, formats or proof does it offer that the client doesn't?"],
            c["answers"], domains=c["top_sources"], competitors=[c["name"]])

    if total < 8:
        add("more-data", "low", "setup", "Run more prompts for reliable results", f"Only {total} answers are analysed. Patterns become trustworthy with a few dozen.", ["Add more prompts in the Prompts tab and run a scan."], 0)

    actions.sort(key=lambda a: (PRIORITY_RANK[a["priority"]], -a["impact"]))
    mock = sum(1 for r in runs if r.is_mock)
    return {
        "has_data": True,
        "days": days,
        "has_mock": mock > 0,
        "mock_pct": round(mock / total * 100),
        "summary": {
            "answers": total,
            "prompts": len(prompt_rows),
            "prompts_with_gap": len(gaps),
            "invisible_prompts": len(invisible),
            "losing_answers": len(losing),
            "losing_pct": round(len(losing) / total * 100),
            "visibility": round(overall, 1),
            "top_competitor": competitors[0]["name"] if competitors else None,
            "weakest_engine": min(engines, key=lambda e: e["vs_overall"])["engine"] if len(engines) > 1 else None,
        },
        "actions": actions[:12],
        "prompt_gaps": gaps[:25],
        "source_gaps": sources,
        "competitors": competitors,
        "engines": engines,
    }
