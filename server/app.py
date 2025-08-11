from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select
from sqlalchemy import text

try:
    from .db import get_session, get_engine
    from .models import Meal, Food
    from .routers import foods, meals, presets, history
except ImportError:  # pragma: no cover
    from db import get_session, get_engine
    from models import Meal, Food
    from routers import foods, meals, presets, history

app = FastAPI(title="Macro Tracker API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(foods.router)
app.include_router(meals.router)
app.include_router(presets.router)
app.include_router(history.router)

def ensure_meal_sort_order_column(session: Session):
    tbl = session.exec(text("SELECT name FROM sqlite_master WHERE type='table' AND name='meal'")).first()
    if not tbl:
        return
    cols = session.exec(text("PRAGMA table_info(meal)")).all()
    names = {row[1] for row in cols}
    if "sort_order" not in names:
        session.exec(text("ALTER TABLE meal ADD COLUMN sort_order INTEGER"))
        session.commit()
        meals = session.exec(select(Meal).where(Meal.sort_order.is_(None))).all()
        for m in meals:
            try:
                num = int(m.name.replace("Meal", "").strip())
                m.sort_order = num
            except:
                m.sort_order = 99
            session.add(m)
        session.commit()

def ensure_food_archived_column(session: Session):
    tbl = session.exec(text("SELECT name FROM sqlite_master WHERE type='table' AND name='food'")).first()
    if not tbl:
        return
    cols = session.exec(text("PRAGMA table_info(food)")).all()
    names = {row[1] for row in cols}
    if "archived" not in names:
        session.exec(text("ALTER TABLE food ADD COLUMN archived INTEGER NOT NULL DEFAULT 0"))
        session.commit()

@app.on_event("startup")
def on_startup():
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        ensure_food_archived_column(s)
        ensure_meal_sort_order_column(s)
