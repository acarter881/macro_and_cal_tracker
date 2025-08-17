"""Migration script to move existing foodlog.db to the new data directory."""

import shutil
from pathlib import Path

from platformdirs import user_data_dir


def migrate_foodlog_db():
    """Move foodlog.db from the current directory to the platform-specific data directory."""
    data_dir = Path(user_data_dir("MacroTracker", "MacroTracker"))
    data_dir.mkdir(parents=True, exist_ok=True)

    old_db_path = Path("foodlog.db")
    new_db_path = data_dir / "foodlog.db"

    if old_db_path.exists() and not new_db_path.exists():
        shutil.move(str(old_db_path), str(new_db_path))
        print(f"Moved {old_db_path} to {new_db_path}")
    else:
        print("No migration needed")


if __name__ == "__main__":
    migrate_foodlog_db()
