from importlib import reload

import httpx
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from server import db


def get_test_engine():
    return create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


def override_get_session(engine):
    def _get_session():
        with Session(engine) as session:
            yield session

    return _get_session


def test_foods_search_missing_usda_key_returns_503(tmp_path, monkeypatch):
    monkeypatch.setenv("USDA_CONFIG_PATH", str(tmp_path / "cfg.json"))
    monkeypatch.delenv("USDA_KEY", raising=False)

    import server.utils as utils

    reload(utils)
    import server.routers.foods as foods

    reload(foods)
    import server.app as app

    reload(app)

    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        resp = client.get("/api/foods/search", params={"q": "apple"})
        assert resp.status_code == 503
        assert "USDA_KEY" in resp.json()["detail"]


def test_foods_search_network_error_returns_503(tmp_path, monkeypatch):
    monkeypatch.setenv("USDA_CONFIG_PATH", str(tmp_path / "cfg.json"))
    monkeypatch.setenv("USDA_KEY", "abc")

    import server.utils as utils

    reload(utils)
    import server.routers.foods as foods

    reload(foods)
    import server.app as app

    reload(app)

    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    async def fake_get(self, *args, **kwargs):
        raise httpx.RequestError("boom")

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        resp = client.get("/api/foods/search", params={"q": "apple"})
        assert resp.status_code == 503
        assert "USDA API request failed" in resp.json()["detail"]
