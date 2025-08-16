"""Add fetched_at column to food

Revision ID: b7aa371b9a51
Revises: 16a51a1de3c0
Create Date: 2024-09-17 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "b7aa371b9a51"
down_revision = "16a51a1de3c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if "fetched_at" not in [c["name"] for c in insp.get_columns("food")]:
        op.add_column("food", sa.Column("fetched_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if "fetched_at" in [c["name"] for c in insp.get_columns("food")]:
        op.drop_column("food", "fetched_at")
