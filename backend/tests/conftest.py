import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["ENGINE_MODE"] = "mock"
# tests must never reach real paid APIs, whatever keys are in backend/.env
os.environ["OPENAI_API_KEY"] = ""
os.environ["SERPAPI_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["MAX_CONCURRENT_CALLS"] = "3"
os.environ["MAX_CALLS_PER_ENGINE"] = "2"

import pytest
from fastapi.testclient import TestClient

from app.core.db import Base, engine
from app.main import app


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c
