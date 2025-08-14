"""Add sort_order and archived columns"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001_add_sort_order_and_archived"
down_revision = None
branch_labels = None
depends_on = None


def _has_column(conn, table: str, column: str) -> bool:
    rows = conn.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
    return any(row[1] == column for row in rows)


def _has_table(conn, table: str) -> bool:
    row = conn.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"), {"name": table}).first()
    return row is not None


def upgrade() -> None:
    conn = op.get_bind()

    if _has_table(conn, "meal") and not _has_column(conn, "meal", "sort_order"):
        conn.execute(sa.text("ALTER TABLE meal ADD COLUMN sort_order INTEGER"))
        meals = conn.execute(sa.text("SELECT id, name FROM meal WHERE sort_order IS NULL")).fetchall()
        for m_id, name in meals:
            try:
                num = int(name.replace('Meal', '').strip())
            except Exception:
                num = 99
            conn.execute(sa.text("UPDATE meal SET sort_order = :num WHERE id = :id"), {"num": num, "id": m_id})

    if _has_table(conn, "foodentry") and not _has_column(conn, "foodentry", "sort_order"):
        conn.execute(sa.text("ALTER TABLE foodentry ADD COLUMN sort_order INTEGER"))
        rows = conn.execute(sa.text("SELECT id, meal_id FROM foodentry ORDER BY meal_id, id")).fetchall()
        current_meal = None
        count = 0
        for entry_id, meal_id in rows:
            if meal_id != current_meal:
                current_meal = meal_id
                count = 1
            else:
                count += 1
            conn.execute(sa.text("UPDATE foodentry SET sort_order = :num WHERE id = :id"), {"num": count, "id": entry_id})

    if _has_table(conn, "food") and not _has_column(conn, "food", "archived"):
        conn.execute(sa.text("ALTER TABLE food ADD COLUMN archived INTEGER NOT NULL DEFAULT 0"))


def downgrade() -> None:
    pass
