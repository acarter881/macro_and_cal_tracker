import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel

from server import utils
from server.db import get_engine
from server.routers import config, foods, history, meals, presets, weight, water
from server.run_migrations import run_migrations

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables and handle graceful shutdown."""
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    run_migrations(str(Path(__file__).resolve().parent.parent / "alembic.ini"), engine)
    try:
        yield
    except asyncio.CancelledError:
        # Swallow cancellation so reloads or Ctrl+C don't raise a stack trace
        pass
    finally:
        await utils.aclose_usda_client()


allowed_origins_raw = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_raw:
    allowed_origins = [
        origin.strip() for origin in allowed_origins_raw.split(",") if origin.strip()
    ]
else:
    allowed_origins = ["*"]

app = FastAPI(title="Macro Tracker API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(foods.router)
app.include_router(meals.router)
app.include_router(presets.router)
app.include_router(history.router)
app.include_router(weight.router)
app.include_router(water.router)
app.include_router(config.router)
