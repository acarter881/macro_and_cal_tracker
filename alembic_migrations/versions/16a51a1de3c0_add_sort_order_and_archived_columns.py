"""Add sort_order and archived columns

Revision ID: 16a51a1de3c0
Revises: 
Create Date: 2024-09-16 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlmodel import Session, select

# revision identifiers, used by Alembic.
revision = "16a51a1de3c0"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if "sort_order" not in [c["name"] for c in insp.get_columns("meal")]:
        op.add_column("meal", sa.Column("sort_order", sa.Integer()))
        from server.models import Meal  # imported lazily

        session = Session(bind=bind)
        meals = session.exec(select(Meal).where(Meal.sort_order.is_(None))).all()
        for m in meals:
            try:
                num = int(m.name.replace("Meal", "").strip())
                m.sort_order = num
            except Exception:
                m.sort_order = 99
            session.add(m)
        session.commit()

    if "sort_order" not in [c["name"] for c in insp.get_columns("foodentry")]:
        op.add_column("foodentry", sa.Column("sort_order", sa.Integer()))
        from server.models import FoodEntry, Meal  # imported lazily

        session = Session(bind=bind)
        meals = session.exec(select(Meal.id).order_by(Meal.id)).all()
        for meal_id in meals:
            ents = session.exec(
                select(FoodEntry)
                .where(FoodEntry.meal_id == meal_id)
                .order_by(FoodEntry.id)
            ).all()
            for idx, e in enumerate(ents, start=1):
                e.sort_order = idx
                session.add(e)
        session.commit()

    if "archived" not in [c["name"] for c in insp.get_columns("food")]:
        op.add_column(
            "food",
            sa.Column("archived", sa.Boolean(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if "archived" in [c["name"] for c in insp.get_columns("food")]:
        op.drop_column("food", "archived")
    if "sort_order" in [c["name"] for c in insp.get_columns("foodentry")]:
        op.drop_column("foodentry", "sort_order")
    if "sort_order" in [c["name"] for c in insp.get_columns("meal")]:
        op.drop_column("meal", "sort_order")
