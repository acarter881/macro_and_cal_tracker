import os

os.environ['USDA_KEY'] = 'test'

from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool

from server import app, db


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


def test_meal_creation_increments_sort_order():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)

        resp1 = client.post('/api/meals', json={'date': '2024-01-01'})
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1['sort_order'] == 1
        assert data1['name'] == 'Meal 1'

        resp2 = client.post('/api/meals', json={'date': '2024-01-01'})
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2['sort_order'] == 2
        assert data2['name'] == 'Meal 2'
