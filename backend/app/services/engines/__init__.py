from app.core.config import get_settings
from app.services.engines.base import Engine
from app.services.engines.mock import MockEngine
from app.services.engines.real import ChatGPTEngine, GoogleAIOEngine

ENGINE_NAMES = ["chatgpt", "google_aio"]


def build_engines(brands: list[str]) -> list[Engine]:
    s = get_settings()
    keys = {
        "chatgpt": (s.openai_api_key, ChatGPTEngine),
        "google_aio": (s.serpapi_api_key, GoogleAIOEngine),
    }
    out: list[Engine] = []
    for name in ENGINE_NAMES:
        key, cls = keys[name]
        if s.engine_mode != "mock" and key:
            out.append(cls())
        else:
            out.append(MockEngine(name, brands))
    return out


def engine_modes() -> dict[str, str]:
    """'live' if the engine will call its real API, else 'demo' (no key, or ENGINE_MODE=mock)."""
    s = get_settings()
    keys = {"chatgpt": s.openai_api_key, "google_aio": s.serpapi_api_key}
    return {n: "live" if s.engine_mode != "mock" and keys[n] else "demo" for n in ENGINE_NAMES}
