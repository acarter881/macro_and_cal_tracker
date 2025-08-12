import os
import sys
from pathlib import Path

os.environ['USDA_KEY'] = 'test'

sys.path.append(str(Path(__file__).resolve().parents[2]))

from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool

from server import app, db
from server.models import Food


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


def test_preset_create_and_apply():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            session.add(Food(
                fdc_id=1,
                description='Food 1',
                kcal_per_100g=100,
                protein_g_per_100g=10,
                carb_g_per_100g=5,
                fat_g_per_100g=2,
            ))
            session.commit()

        resp = client.post('/api/presets', json={'name': 'Preset1', 'items': [{'fdc_id': 1, 'grams': 50}]})
        assert resp.status_code == 200
        preset_id = resp.json()['id']

        resp_list = client.get('/api/presets')
        assert resp_list.status_code == 200
        assert resp_list.json()['items'][0]['item_count'] == 1

        resp_detail = client.get(f'/api/presets/{preset_id}')
        assert resp_detail.status_code == 200
        assert resp_detail.json()['items'][0]['fdc_id'] == 1

        resp_apply = client.post(f'/api/presets/{preset_id}/apply', json={'date': '2024-01-01', 'meal_name': 'Meal 1'})
        assert resp_apply.status_code == 200
        assert resp_apply.json()['added'] == 1

        day = client.get('/api/days/2024-01-01')
        assert day.status_code == 200
        assert len(day.json()['entries']) == 1
