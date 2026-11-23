# Lumen — AI visibility tracker for agencies

Tracks whether ChatGPT and Google AI Overviews mention your clients' brands.

- `backend/` — FastAPI, SQLAlchemy 2, Alembic (SQLite by default, Neon Postgres via `DATABASE_URL`)
- `frontend/` — Next.js 16, Tailwind 4, TanStack Query, Recharts, Motion (glassmorphism UI)

## Run locally
```bash
# API  (http://localhost:8010, docs at /docs)
cd backend && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --port 8010 --reload

# Web  (http://localhost:3010)
cd frontend && npm install && npm run dev -- -p 3010
```
Ports 8010/3010 are used because 8000/3000 were taken on the dev machine; change `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` if you change them.

## How scans work
Nothing runs on its own: there is no scheduler. A scan starts only when a user presses **Run scan** (all active prompts) or the play button on a prompt. Each prompt is sent to both engines in the background. The page shows live progress (queued, asking, analyzing, done) and a summary when it finishes. Runs left in flight by an API restart are marked failed on startup.

## Protecting your API budget
All engine calls share one queue, so a big scan can't flood the providers. Tune in `backend/.env`:
- `MAX_CONCURRENT_CALLS` (8) calls in flight across the whole server, `MAX_CALLS_PER_ENGINE` (4) per provider. The rest wait as "Queued".
- `DAILY_ANSWER_LIMIT` (500) live answers per agency per rolling 24 h (demo answers are free). A scan that would exceed it is refused up front with the number left.
- `MAX_ACTIVE_ANSWERS` (300) queued or running answers per agency; `SCAN_STARTS_PER_MINUTE` (6) per user.
- Only one scan can run per client at a time, which also stops double-clicks.
Limits are kept in memory/DB for a single API instance.

## Engines
With no API keys the app uses a **demo engine** (results are flagged "Demo"). Add keys in `backend/.env`
(`OPENAI_API_KEY`, `SERPAPI_API_KEY`) and each engine switches to the real API on its own.
`ENGINE_MODE=mock` forces demo mode.

## Switch to Neon
Set `DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` (prefer Neon's pooled host) and run `alembic upgrade head`.

## Email and alerts
- Password reset and visibility alerts are sent by email. An alert is checked right after a scan you started finishes (week-over-week change of 10+ points).
- With `SMTP_HOST` empty, emails are only printed in the API log, which is handy in development.
- Alerts also appear in the bell in the sidebar. Users can turn emails off in Settings.

## Improve tab: gap analysis and drafting
The **Improve** tab compares who the AI recommends instead of the client, which sources it cites, and turns that into an action plan (no API cost, it only reads saved answers).
Each action has a **Draft this with Claude** button that writes the content (FAQ pages, comparison pages, schema, `llms.txt`, outreach emails). It needs `ANTHROPIC_API_KEY`; `DRAFT_MODEL` picks the model and `DAILY_DRAFT_LIMIT` (30 per agency per 24 h) caps cost. Drafts are saved, never invent facts (unknown details become `[PLACEHOLDER]`s), and should be reviewed by a person before publishing. Run `alembic upgrade head` to create the `drafts` table.

## Optional LLM sentiment
Set `ANTHROPIC_API_KEY` to score sentiment per brand mention with a small Claude model (`PARSER_MODEL`).
Without it, a built-in word-list scorer is used.

## Docker
`docker compose up --build` starts the API (http://localhost:8010) and web app (http://localhost:3010).
Set `SENTRY_DSN` to enable error reporting.

## Tests
`cd backend && pytest -q`
