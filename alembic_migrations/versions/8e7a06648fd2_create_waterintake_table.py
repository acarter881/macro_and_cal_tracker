"""Create waterintake table

Revision ID: 8e7a06648fd2
Revises: b7aa371b9a51
Create Date: 2024-09-18 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "8e7a06648fd2"
down_revision = "b7aa371b9a51"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if "waterintake" not in insp.get_table_names():
        op.create_table(
            "waterintake",
            sa.Column("date", sa.String(), primary_key=True),
            sa.Column("milliliters", sa.Float(), nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if "waterintake" in insp.get_table_names():
        op.drop_table("waterintake")
