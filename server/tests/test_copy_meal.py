import os

os.environ['USDA_KEY'] = 'test'

from datetime import date
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool

from server import app, db
from server.models import Food, Meal, FoodEntry


def get_test_engine():
    return create_engine(
        'sqlite://',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )


def override_get_session(engine):
    def _get_session():
        with Session(engine) as session:
            yield session
    return _get_session


def test_copy_meal_assigns_sort_order():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            food = Food(
                fdc_id=1,
                description='Test Food',
                kcal_per_100g=100,
                protein_g_per_100g=10,
                carb_g_per_100g=5,
                fat_g_per_100g=2,
            )
            source_meal = Meal(date=date(2024, 1, 1).isoformat(), name='Meal 1', sort_order=1)
            dest_meal = Meal(date=date(2024, 1, 2).isoformat(), name='Meal 1', sort_order=1)
            session.add(food)
            session.add(source_meal)
            session.add(dest_meal)
            session.commit()
            source_meal_id = source_meal.id
            dest_meal_id = dest_meal.id
            session.add(FoodEntry(meal_id=source_meal_id, fdc_id=1, quantity_g=100, sort_order=1))
            session.add(FoodEntry(meal_id=source_meal_id, fdc_id=1, quantity_g=150, sort_order=2))
            session.add(FoodEntry(meal_id=dest_meal_id, fdc_id=1, quantity_g=50, sort_order=1))
            session.commit()

        resp = client.post(
            f'/api/meals/{source_meal_id}/copy_to',
            json={'date': date(2024, 1, 2).isoformat(), 'meal_name': 'Meal 1'},
        )
        assert resp.status_code == 201
        assert resp.json()['added_count'] == 2

        day = date(2024, 1, 2).isoformat()
        resp_day = client.get(f'/api/days/{day}')
        assert resp_day.status_code == 200
        data = resp_day.json()
        dest_entries = [e for e in data['entries'] if e['meal_id'] == dest_meal_id]
        assert [e['sort_order'] for e in dest_entries] == [1, 2, 3]
