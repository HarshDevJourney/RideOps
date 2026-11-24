import pytest
from fastapi.testclient import TestClient

from app import config
from app.context import build_context
from app.main import create_app
from app.services.data_service import DataCatalog


@pytest.fixture(scope="session")
def ctx(tmp_path_factory):
    d = tmp_path_factory.mktemp("ctx")
    return build_context(DataCatalog(config.DATA_PATH, d / "uploads", d / "state"))      # only the original data


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    d = tmp_path_factory.mktemp("api")
    with TestClient(create_app(state_dir=d / "state", uploads_dir=d / "uploads")) as c:
        yield c
