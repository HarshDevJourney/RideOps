import pytest
from fastapi.testclient import TestClient

from app.context import build_context
from app.main import create_app


@pytest.fixture(scope="session")
def ctx(tmp_path_factory):
    return build_context(feedback_path=tmp_path_factory.mktemp("fb") / "feedback.json")


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    with TestClient(create_app(feedback_path=tmp_path_factory.mktemp("api_fb") / "feedback.json")) as c:
        yield c
