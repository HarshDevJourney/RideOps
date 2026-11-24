import pytest
from fastapi.testclient import TestClient

from app.context import build_context
from app.main import create_app


@pytest.fixture(scope="session")
def ctx(tmp_path_factory):
    return build_context(state_dir=tmp_path_factory.mktemp("state"))


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    with TestClient(create_app(state_dir=tmp_path_factory.mktemp("api_state"))) as c:
        yield c
