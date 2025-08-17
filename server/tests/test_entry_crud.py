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


def test_entry_crud_flow():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
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

        resp = client.post(
            "/api/entries", json={"meal_id": meal_id, "fdc_id": 1, "quantity_g": 100}
        )
        assert resp.status_code == 200
        entry_id = resp.json()["id"]
        assert resp.json()["quantity_g"] == 100

        # create second entry
        resp_extra = client.post(
            "/api/entries", json={"meal_id": meal_id, "fdc_id": 1, "quantity_g": 50}
        )
        assert resp_extra.status_code == 200
        entry_id2 = resp_extra.json()["id"]

        resp2 = client.patch(f"/api/entries/{entry_id}", json={"quantity_g": 150})
        assert resp2.status_code == 200
        assert resp2.json()["quantity_g"] == 150.0

        # move second entry to top
        resp_move = client.patch(f"/api/entries/{entry_id2}", json={"sort_order": 1})
        assert resp_move.status_code == 200

        day = date(2024, 1, 1).isoformat()
        resp3 = client.get(f"/api/days/{day}")
        assert resp3.status_code == 200
        data = resp3.json()
        assert data["entries"][0]["id"] == entry_id2
        assert data["entries"][1]["id"] == entry_id
        assert data["entries"][1]["quantity_g"] == 150.0
        assert data["totals"] == {
            "kcal": 200.0,
            "protein": 20.0,
            "carb": 10.0,
            "fat": 4.0,
        }

        resp4 = client.delete(f"/api/entries/{entry_id2}")
        assert resp4.status_code == 200

        resp5 = client.get(f"/api/days/{day}")
        assert resp5.status_code == 200
        assert len(resp5.json()["entries"]) == 1
        assert resp5.json()["totals"] == {
            "kcal": 150.0,
            "protein": 15.0,
            "carb": 7.5,
            "fat": 3.0,
        }


def test_move_last_entry_to_top():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
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

        entry_ids = []
        for qty in (100, 200, 300):
            resp = client.post(
                "/api/entries",
                json={"meal_id": meal_id, "fdc_id": 1, "quantity_g": qty},
            )
            assert resp.status_code == 200
            entry_ids.append(resp.json()["id"])

        resp_move = client.patch(f"/api/entries/{entry_ids[2]}", json={"sort_order": 1})
        assert resp_move.status_code == 200

        day = date(2024, 1, 1).isoformat()
        resp_day = client.get(f"/api/days/{day}")
        assert resp_day.status_code == 200
        data = resp_day.json()
        assert [e["id"] for e in data["entries"]] == [
            entry_ids[2],
            entry_ids[0],
            entry_ids[1],
        ]


def test_move_first_entry_to_bottom():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
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

        entry_ids = []
        for qty in (100, 200, 300):
            resp = client.post(
                "/api/entries",
                json={"meal_id": meal_id, "fdc_id": 1, "quantity_g": qty},
            )
            assert resp.status_code == 200
            entry_ids.append(resp.json()["id"])

        resp_move = client.patch(f"/api/entries/{entry_ids[0]}", json={"sort_order": 3})
        assert resp_move.status_code == 200

        day = date(2024, 1, 1).isoformat()
        resp_day = client.get(f"/api/days/{day}")
        assert resp_day.status_code == 200
        data = resp_day.json()
        assert [e["id"] for e in data["entries"]] == [
            entry_ids[1],
            entry_ids[2],
            entry_ids[0],
        ]


def test_negative_quantity_rejected():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
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

        resp_neg = client.post(
            "/api/entries", json={"meal_id": meal_id, "fdc_id": 1, "quantity_g": -10}
        )
        assert resp_neg.status_code == 422

        resp_pos = client.post(
            "/api/entries", json={"meal_id": meal_id, "fdc_id": 1, "quantity_g": 10}
        )
        assert resp_pos.status_code == 200
        entry_id = resp_pos.json()["id"]

        resp_update_neg = client.patch(
            f"/api/entries/{entry_id}", json={"quantity_g": -5}
        )
        assert resp_update_neg.status_code == 422


def test_delete_middle_entry_reorders():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
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

        entry_ids = []
        for qty in (100, 200, 300, 400):
            resp = client.post(
                "/api/entries",
                json={"meal_id": meal_id, "fdc_id": 1, "quantity_g": qty},
            )
            assert resp.status_code == 200
            entry_ids.append(resp.json()["id"])

        # delete the third entry (currently sort_order 3)
        resp_del = client.delete(f"/api/entries/{entry_ids[2]}")
        assert resp_del.status_code == 200

        day = date(2024, 1, 1).isoformat()
        resp_day = client.get(f"/api/days/{day}")
        assert resp_day.status_code == 200
        data = resp_day.json()
        # remaining entries should have sequential sort_orders
        assert [e["sort_order"] for e in data["entries"]] == [1, 2, 3]
