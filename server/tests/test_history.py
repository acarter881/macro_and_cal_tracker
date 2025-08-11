import os
import sys
from pathlib import Path

os.environ['USDA_KEY'] = 'test'

# Allow importing the server modules
sys.path.append(str(Path(__file__).resolve().parents[2]))

from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool

from server import app, db
from server.models import Food, Meal, FoodEntry, BodyWeight


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


def test_history_returns_macros_and_weight():
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
            session.add(food)
            meal1 = Meal(date='2024-01-01', name='Meal 1', sort_order=1)
            meal2 = Meal(date='2024-01-02', name='Meal 1', sort_order=1)
            session.add_all([meal1, meal2])
            session.commit()
            e1 = FoodEntry(meal_id=meal1.id, fdc_id=1, quantity_g=100)
            e2 = FoodEntry(meal_id=meal2.id, fdc_id=1, quantity_g=200)
            session.add_all([e1, e2])
            w1 = BodyWeight(date='2024-01-01', weight=180)
            w2 = BodyWeight(date='2024-01-02', weight=181)
            session.add_all([w1, w2])
            session.commit()

        resp = client.get('/api/history', params={'start_date': '2024-01-01', 'end_date': '2024-01-02'})
        assert resp.status_code == 200
        data = resp.json()
        assert data == [
            {'date': '2024-01-01', 'kcal': 100.0, 'protein': 10.0, 'carb': 5.0, 'fat': 2.0, 'weight': 180.0},
            {'date': '2024-01-02', 'kcal': 200.0, 'protein': 20.0, 'carb': 10.0, 'fat': 4.0, 'weight': 181.0},
        ]
