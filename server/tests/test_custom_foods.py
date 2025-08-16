from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool

from server import app, db


def get_test_engine():
    return create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)


def override_get_session(engine):
    def _get_session():
        with Session(engine) as session:
            yield session
    return _get_session


def test_create_and_search_custom_food():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        payload = {
            'description': 'Test Food',
            'unit_name': 'pill',
            'kcal_per_unit': 100,
            'protein_g_per_unit': 10,
            'carb_g_per_unit': 5,
            'fat_g_per_unit': 2,
        }
        resp = client.post('/api/custom_foods', json=payload)
        assert resp.status_code == 200
        created = resp.json()
        assert created['description'] == 'Test Food'
        assert created['unit_name'] == 'pill'
        assert created['kcal_per_unit'] == 100
        assert 'fdc_id' in created

        resp_search = client.get('/api/custom_foods/search', params={'q': 'Test'})
        assert resp_search.status_code == 200
        results = resp_search.json()
        assert isinstance(results, list)
        assert results[0]['fdcId'] == created['fdc_id']
        assert results[0]['description'] == 'Test Food'
        assert results[0]['dataType'] == 'Custom'
        assert results[0]['unit_name'] == 'pill'

        resp_my = client.get('/api/my_foods')
        assert resp_my.status_code == 200
        myfoods = resp_my.json()
        assert myfoods[0]['fdcId'] == created['fdc_id']
        assert myfoods[0]['description'] == 'Test Food'
        assert myfoods[0]['unit_name'] == 'pill'
