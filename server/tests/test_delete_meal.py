import os
import sys

from pathlib import Path

os.environ['USDA_KEY'] = 'test'

# Allow importing the server modules
sys.path.append(str(Path(__file__).resolve().parents[2]))

from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool

from server import app, db
from server.models import Meal


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


def test_delete_meal_renumbers():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            meals = [
                Meal(date='2024-01-01', name='Meal 1', sort_order=1),
                Meal(date='2024-01-01', name='Meal 2', sort_order=2),
                Meal(date='2024-01-01', name='Meal 3', sort_order=3),
            ]
            session.add_all(meals)
            session.commit()
            ids = [m.id for m in meals]

        resp = client.delete(f"/api/meals/{ids[1]}")
        assert resp.status_code == 200

        with Session(engine) as session:
            remaining = session.exec(
                select(Meal)
                .where(Meal.date == '2024-01-01')
                .order_by(Meal.sort_order)
            ).all()

            assert [m.sort_order for m in remaining] == [1, 2]
            assert [m.name for m in remaining] == ['Meal 1', 'Meal 2']

