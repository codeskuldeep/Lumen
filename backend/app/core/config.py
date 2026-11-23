from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./visibility.db"
    secret_key: str = "dev-secret-change-me"
    access_token_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:3000"
    frontend_url: str = "http://localhost:3000"

    engine_mode: str = "auto"  # auto | mock
    openai_api_key: str = ""
    serpapi_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    openai_reasoning_effort: str = "low"  # low | medium | high | "" (model default). Lower = faster and cheaper


    # Protection for your API budget (all counted per server / per agency, see services/limits.py)
    max_concurrent_calls: int = 8  # engine calls in flight at once, whole server
    max_calls_per_engine: int = 4  # ...and per engine, to stay under each provider's rate limit
    daily_answer_limit: int = 500  # live (paid) answers per agency per rolling 24 h; demo answers are free
    max_active_answers: int = 300  # answers queued or running per agency at once
    scan_starts_per_minute: int = 6  # run-button presses per user per minute

    # Email (leave smtp_host empty in dev: emails are logged instead of sent)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Lumen <no-reply@localhost>"

    # Optional LLM-based sentiment (more accurate than the built-in word list)
    anthropic_api_key: str = ""
    parser_model: str = "claude-haiku-5-5"
    draft_model: str = "claude-sonnet-5-5"  # writes the drafted content; needs ANTHROPIC_API_KEY
    daily_draft_limit: int = 30  # drafts per agency per rolling 24 h
    sentry_dsn: str = ""

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
