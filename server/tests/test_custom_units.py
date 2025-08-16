from datetime import date
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


def test_custom_unit_food():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            food = Food(
                fdc_id=-1,
                description='Fish Oil',
                data_type='Custom',
                kcal_per_100g=0,
                protein_g_per_100g=0,
                carb_g_per_100g=0,
                fat_g_per_100g=0,
                unit_name='softgel',
                kcal_per_unit=5,
                protein_g_per_unit=0,
                carb_g_per_unit=0,
                fat_g_per_unit=0.5,
            )
            meal = Meal(date=date(2024, 1, 1).isoformat(), name='Meal 1', sort_order=1)
            session.add(food)
            session.add(meal)
            session.commit()
            meal_id = meal.id
        resp = client.post('/api/entries', json={'meal_id': meal_id, 'fdc_id': -1, 'quantity_g': 2})
        assert resp.status_code == 200
        day_resp = client.get(f'/api/days/{date(2024, 1, 1).isoformat()}/full')
        assert day_resp.status_code == 200
        data = day_resp.json()
        entry = data['meals'][0]['entries'][0]
        assert entry['quantity_g'] == 2
        assert entry['kcal'] == 10.0
        assert entry['fat'] == 1.0
        assert entry['unit_name'] == 'softgel'
