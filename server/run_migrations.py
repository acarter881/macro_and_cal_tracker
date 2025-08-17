"""Utility to run database migrations if Alembic is installed.

This module attempts to import Alembic at runtime. If the package is not
available (such as in the test environment), the ``run_migrations`` function
simply returns without raising an error. This keeps the application and test
suite functional without requiring Alembic as a hard dependency.
"""

from __future__ import annotations


def run_migrations(config_path: str = "alembic.ini", engine=None) -> None:
    """Run Alembic migrations if the package is installed.

    Parameters
    ----------
    config_path:
        Path to the Alembic configuration file. Defaults to ``alembic.ini``.
    engine:
        Optional SQLAlchemy engine. If provided, migrations run using this
        engine's connection. Otherwise Alembic uses the configuration file's
        ``sqlalchemy.url`` setting.
    """
    try:
        from alembic import command
        from alembic.config import Config
    except ModuleNotFoundError:  # pragma: no cover - import guard
        # Alembic is optional; missing installation is fine in tests.
        return

    cfg = Config(config_path)
    if engine is not None:
        with engine.begin() as connection:
            cfg.attributes["connection"] = connection
            command.upgrade(cfg, "head")
    else:
        command.upgrade(cfg, "head")
