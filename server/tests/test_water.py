from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from server import app, db


def get_test_engine():
    """Return a SQLite engine that keeps data in memory for the test."""
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def override_get_session(engine):
    def _get_session():
        with Session(engine) as session:
            yield session

    return _get_session


def setup_client():
    """Create a TestClient wired to a temporary in-memory database."""
    engine = get_test_engine()
    db.engine = engine
    app.app.dependency_overrides[db.get_session] = override_get_session(engine)
    SQLModel.metadata.create_all(engine)
    return TestClient(app.app)


def test_put_and_get_water():
    """PUT should create a record and GET should retrieve it."""
    with setup_client() as client:
        resp = client.put(
            f"/api/water/{date(2024, 1, 1).isoformat()}",
            json={"milliliters": 500},
        )
        assert resp.status_code == 200
        assert resp.json()["milliliters"] == 500

        resp = client.get(f"/api/water/{date(2024, 1, 1).isoformat()}")
        assert resp.status_code == 200
        assert resp.json()["milliliters"] == 500


def test_put_water_overwrites_previous():
    """A subsequent PUT for the same date should overwrite the previous value."""
    with setup_client() as client:
        client.put(
            f"/api/water/{date(2024, 1, 1).isoformat()}",
            json={"milliliters": 500},
        )

        resp = client.put(
            f"/api/water/{date(2024, 1, 1).isoformat()}",
            json={"milliliters": 750},
        )
        assert resp.status_code == 200

        resp = client.get(f"/api/water/{date(2024, 1, 1).isoformat()}")
        assert resp.status_code == 200
        assert resp.json()["milliliters"] == 750


def test_get_water_not_found():
    """GET for a date without data should return 404."""
    with setup_client() as client:
        resp = client.get(f"/api/water/{date(2024, 2, 1).isoformat()}")
        assert resp.status_code == 404

