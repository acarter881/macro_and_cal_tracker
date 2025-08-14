from pathlib import Path

from alembic import command
from alembic.config import Config

from .db import DATABASE_URL


def run_migrations() -> None:
    root_dir = Path(__file__).resolve().parent.parent
    cfg = Config(str(root_dir / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    command.upgrade(cfg, "head")
