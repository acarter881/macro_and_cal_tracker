import pytest
from datetime import datetime, timedelta
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool

from server import db, utils
from server.models import Food
from server.utils import ensure_food_cached
import asyncio


def get_test_engine():
    return create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)


def test_ensure_food_cached_uses_cache(monkeypatch):
    engine = get_test_engine()
    db.engine = engine
    SQLModel.metadata.create_all(engine)
    now = datetime.utcnow()
    with Session(engine) as session:
        food = Food(
            fdc_id=1,
            description='Old',
            kcal_per_100g=50,
            protein_g_per_100g=5,
            fat_g_per_100g=1,
            carb_g_per_100g=2,
            fetched_at=now,
        )
        session.add(food)
        session.commit()
    called = False

    async def fake_fetch(_):
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(utils, 'fetch_food_detail', fake_fetch)

    with Session(engine) as session:
        result = asyncio.run(ensure_food_cached(1, session))
        assert result.fdc_id == 1
        assert result.description == 'Old'
    assert called is False


def test_ensure_food_cached_refreshes_stale(monkeypatch):
    engine = get_test_engine()
    db.engine = engine
    SQLModel.metadata.create_all(engine)
    old_time = datetime.utcnow() - timedelta(days=60)
    with Session(engine) as session:
        food = Food(
            fdc_id=2,
            description='Old',
            kcal_per_100g=10,
            protein_g_per_100g=1,
            fat_g_per_100g=1,
            carb_g_per_100g=1,
            fetched_at=old_time,
        )
        session.add(food)
        session.commit()

    async def new_fetch(_):
        return {
            'description': 'New',
            'labelNutrients': {
                'calories': {'value': 200},
                'protein': {'value': 20},
                'fat': {'value': 10},
                'carbohydrates': {'value': 30},
            },
        }

    monkeypatch.setattr(utils, 'fetch_food_detail', new_fetch)

    with Session(engine) as session:
        result = asyncio.run(ensure_food_cached(2, session))
        assert result.description == 'New'
        assert result.kcal_per_100g == 200
        assert result.protein_g_per_100g == 20
        assert result.fetched_at > old_time
