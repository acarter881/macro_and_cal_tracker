import os

os.environ["USDA_KEY"] = "test"

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from server import app, db
from server.models import Food, Meal


def get_test_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def override_get_session(engine):
    def _get_session():
        with Session(engine) as session:
            yield session

    return _get_session


def test_update_entry_rollback_on_error(monkeypatch):
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app, raise_server_exceptions=False) as client:
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            food = Food(
                fdc_id=1,
                description="Test Food",
                kcal_per_100g=100,
                protein_g_per_100g=10,
                carb_g_per_100g=5,
                fat_g_per_100g=2,
            )
            meal = Meal(date=date(2024, 1, 1).isoformat(), name="Meal 1", sort_order=1)
            session.add(food)
            session.add(meal)
            session.commit()
            meal_id = meal.id

        resp1 = client.post(
            "/api/entries", json={"meal_id": meal_id, "fdc_id": 1, "quantity_g": 100}
        )
        assert resp1.status_code == 200
        entry_id1 = resp1.json()["id"]

        resp2 = client.post(
            "/api/entries", json={"meal_id": meal_id, "fdc_id": 1, "quantity_g": 50}
        )
        assert resp2.status_code == 200
        entry_id2 = resp2.json()["id"]

        original_flush = Session.flush
        calls = {"n": 0}

        def failing_flush(self, *args, **kwargs):
            calls["n"] += 1
            if calls["n"] == 3:
                raise RuntimeError("boom")
            return original_flush(self, *args, **kwargs)

        monkeypatch.setattr(Session, "flush", failing_flush)

        resp_fail = client.patch(
            f"/api/entries/{entry_id2}",
            json={"sort_order": 1, "quantity_g": 75},
        )
        assert resp_fail.status_code == 500

        monkeypatch.setattr(Session, "flush", original_flush)

        day = date(2024, 1, 1).isoformat()
        resp_day = client.get(f"/api/days/{day}")
        assert resp_day.status_code == 200
        data = resp_day.json()
        assert [e["id"] for e in data["entries"]] == [entry_id1, entry_id2]
        assert [e["quantity_g"] for e in data["entries"]] == [100.0, 50.0]
