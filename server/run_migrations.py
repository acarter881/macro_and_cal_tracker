"""Utility to run database migrations if Alembic is installed.

This module attempts to import Alembic at runtime. If the package is not
available (such as in the test environment), the ``run_migrations`` function
simply returns without raising an error. This keeps the application and test
suite functional without requiring Alembic as a hard dependency.
"""
from __future__ import annotations


def run_migrations(config_path: str = "alembic.ini") -> None:
    """Run Alembic migrations if the package is installed.

    Parameters
    ----------
    config_path:
        Path to the Alembic configuration file. Defaults to ``alembic.ini``.
    """
    try:
        from alembic import command
        from alembic.config import Config
    except ModuleNotFoundError:  # pragma: no cover - import guard
        # Alembic is optional; missing installation is fine in tests.
        return

    cfg = Config(config_path)
    command.upgrade(cfg, "head")
