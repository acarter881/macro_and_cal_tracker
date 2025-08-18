from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from server import app, db
from server.models import Meal


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


def test_custom_unit_food():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            meal = Meal(date=date(2024, 1, 1).isoformat(), name="Meal 1", sort_order=1)
            session.add(meal)
            session.commit()
            meal_id = meal.id
        resp_food = client.post(
            "/api/custom_foods",
            json={
                "description": "Fish Oil",
                "unit_name": "softgel",
                "kcal_per_unit": 5,
                "protein_g_per_unit": 0,
                "carb_g_per_unit": 0,
                "fat_g_per_unit": 0.5,
            },
        )
        assert resp_food.status_code == 200
        fdc_id = resp_food.json()["fdc_id"]
        resp = client.post(
            "/api/entries", json={"meal_id": meal_id, "fdc_id": fdc_id, "quantity_g": 2}
        )
        assert resp.status_code == 200
        day_resp = client.get(f"/api/days/{date(2024, 1, 1).isoformat()}/full")
        assert day_resp.status_code == 200
        data = day_resp.json()
        entry = data["meals"][0]["entries"][0]
        assert entry["quantity_g"] == 2
        assert entry["kcal"] == 10.0
        assert entry["fat"] == 1.0
        assert entry["unit_name"] == "softgel"
