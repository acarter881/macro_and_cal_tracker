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


def test_set_and_get_weight():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)

        resp = client.put("/api/weight/2024-01-01", json={"weight": 180})
        assert resp.status_code == 200
        assert resp.json()["weight"] == 180

        resp2 = client.get("/api/weight/2024-01-01")
        assert resp2.status_code == 200
        assert resp2.json()["weight"] == 180


def test_update_weight_overwrites_previous():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)

        resp = client.put("/api/weight/2024-01-01", json={"weight": 180})
        assert resp.status_code == 200

        resp = client.put("/api/weight/2024-01-01", json={"weight": 182})
        assert resp.status_code == 200

        resp2 = client.get("/api/weight/2024-01-01")
        assert resp2.status_code == 200
        assert resp2.json()["weight"] == 182


def test_get_weight_not_found():
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)

    with TestClient(app.app) as client:
        SQLModel.metadata.create_all(engine)

        resp = client.get("/api/weight/2024-02-01")
        assert resp.status_code == 404
