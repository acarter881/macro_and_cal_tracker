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


def test_foods_get_handles_malformed_nutrients(tmp_path, monkeypatch):
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

    async def fake_fetch_food_detail(fdc_id: int):
        return {
            "description": "Fake Food",
            "foodNutrients": [
                {"nutrientId": 1003, "amount": "oops"},
                {"nutrientId": 1004, "amount": 5},
                {"nutrientId": 1008, "amount": 100},
            ],
        }

    class DummyAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def get(self, *args, **kwargs):
            raise httpx.RequestError("boom")

    monkeypatch.setattr(foods, "fetch_food_detail", fake_fetch_food_detail)
    monkeypatch.setattr(httpx, "AsyncClient", DummyAsyncClient)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        resp = client.get("/api/foods/123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["protein_g_per_100g"] == 0.0
        assert data["fat_g_per_100g"] == 5.0
