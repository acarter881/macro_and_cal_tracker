import os

os.environ["USDA_KEY"] = "test"

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from server import app, db
from server.models import Food, FoodEntry, Meal


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


def test_recents_order_and_limit():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            foods = [
                Food(
                    fdc_id=1,
                    description="Food 1",
                    kcal_per_100g=1,
                    protein_g_per_100g=1,
                    carb_g_per_100g=1,
                    fat_g_per_100g=1,
                ),
                Food(
                    fdc_id=2,
                    description="Food 2",
                    kcal_per_100g=1,
                    protein_g_per_100g=1,
                    carb_g_per_100g=1,
                    fat_g_per_100g=1,
                ),
                Food(
                    fdc_id=3,
                    description="Food 3",
                    kcal_per_100g=1,
                    protein_g_per_100g=1,
                    carb_g_per_100g=1,
                    fat_g_per_100g=1,
                ),
            ]
            meal = Meal(date="2024-01-01", name="Meal", sort_order=1)
            session.add(meal)
            session.add_all(foods)
            session.commit()
            entries = [
                FoodEntry(meal_id=meal.id, fdc_id=1, quantity_g=100, sort_order=1),
                FoodEntry(meal_id=meal.id, fdc_id=2, quantity_g=100, sort_order=2),
                FoodEntry(meal_id=meal.id, fdc_id=1, quantity_g=100, sort_order=3),
                FoodEntry(meal_id=meal.id, fdc_id=3, quantity_g=100, sort_order=4),
            ]
            session.add_all(entries)
            session.commit()

        resp = client.get("/api/recents", params={"limit": 3})
        assert resp.status_code == 200
        assert [item["fdc_id"] for item in resp.json()["items"]] == [3, 1, 2]

        resp2 = client.get("/api/recents", params={"limit": 2})
        assert resp2.status_code == 200
        assert [item["fdc_id"] for item in resp2.json()["items"]] == [3, 1]
