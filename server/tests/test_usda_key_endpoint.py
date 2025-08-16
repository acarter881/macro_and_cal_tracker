import json

# ensure config path temporary

def test_usda_key_update(tmp_path, monkeypatch):
    monkeypatch.setenv('USDA_CONFIG_PATH', str(tmp_path / 'cfg.json'))
    monkeypatch.setenv('USDA_KEY', 'envkey')
    monkeypatch.setenv('CONFIG_AUTH_TOKEN', 'token')
    from importlib import reload
    import server.utils as utils
    reload(utils)
    import server.routers.foods as foods
    reload(foods)
    import server.app as app
    reload(app)
    from fastapi.testclient import TestClient
    from server import db
    from sqlmodel import SQLModel, Session, create_engine
    from sqlalchemy.pool import StaticPool

    def get_test_engine():
        return create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)

    def override_get_session(engine):
        def _get_session():
            with Session(engine) as session:
                yield session
        return _get_session

    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)
        headers = {'X-Config-Token': 'token'}
        # initial key from env
        resp = client.get('/api/config/usda-key', headers=headers)
        assert resp.status_code == 200
        assert resp.json()['key'] == 'envkey'
        # update key
        resp = client.post('/api/config/usda-key', json={'key': 'newkey'}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()['ok'] is True
        # verify
        resp = client.get('/api/config/usda-key', headers=headers)
        assert resp.json()['key'] == 'newkey'
        cfg = json.load(open(tmp_path / 'cfg.json'))
        assert cfg['usda_key'] == 'newkey'
