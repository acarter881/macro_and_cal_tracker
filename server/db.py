import shutil
from pathlib import Path

try:
    from platformdirs import user_data_dir
except ModuleNotFoundError:  # pragma: no cover

    def user_data_dir(appname: str, appauthor: str) -> str:
        """Fallback implementation if platformdirs is unavailable."""
        return str(Path.home() / f".{appname}")


from sqlmodel import Session, create_engine

data_dir = Path(user_data_dir("MacroTracker", "MacroTracker"))
data_dir.mkdir(parents=True, exist_ok=True)

old_db_path = Path("foodlog.db")
new_db_path = data_dir / "foodlog.db"
if old_db_path.exists() and not new_db_path.exists():
    shutil.move(str(old_db_path), str(new_db_path))

DATABASE_URL = f"sqlite:///{new_db_path}"
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def get_engine():
    return engine


def get_session():
    with Session(get_engine()) as session:
        yield session
