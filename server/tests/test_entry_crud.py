import os
import sys
from pathlib import Path

os.environ['USDA_KEY'] = 'test'

sys.path.append(str(Path(__file__).resolve().parents[2]))

from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool

from server import app, db
from server.models import Food, Meal


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


def test_entry_crud_flow():
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
            meal = Meal(date='2024-01-01', name='Meal 1', sort_order=1)
            session.add(food)
            session.add(meal)
            session.commit()
            meal_id = meal.id

        resp = client.post('/api/entries', json={'meal_id': meal_id, 'fdc_id': 1, 'quantity_g': 100})
        assert resp.status_code == 200
        entry_id = resp.json()['id']
        assert resp.json()['quantity_g'] == 100

        resp2 = client.patch(f'/api/entries/{entry_id}', json={'quantity_g': 150})
        assert resp2.status_code == 200
        assert resp2.json()['quantity_g'] == 150.0

        resp3 = client.get('/api/days/2024-01-01')
        assert resp3.status_code == 200
        data = resp3.json()
        assert data['entries'][0]['fdc_id'] == 1
        assert data['entries'][0]['quantity_g'] == 150.0
        assert data['totals'] == {'kcal': 150.0, 'protein': 15.0, 'carb': 7.5, 'fat': 3.0}

        resp4 = client.delete(f'/api/entries/{entry_id}')
        assert resp4.status_code == 200

        resp5 = client.get('/api/days/2024-01-01')
        assert resp5.status_code == 200
        assert resp5.json()['entries'] == []
        assert resp5.json()['totals'] == {'kcal': 0.0, 'protein': 0.0, 'carb': 0.0, 'fat': 0.0}
