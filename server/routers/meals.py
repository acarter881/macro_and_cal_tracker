from typing import Optional, List, Dict
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlmodel import Session, select
from sqlalchemy import func, delete
from pydantic import BaseModel

from ..db import get_session
from ..models import Meal, FoodEntry, Food
from ..utils import get_or_create_meal, ensure_food_cached

router = APIRouter()

class MealCreate(BaseModel):
    date: str

class MealUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None

@router.post("/api/meals", response_model=Meal)
def create_meal(payload: MealCreate, session: Session = Depends(get_session)):
    max_sort_order = session.exec(
        select(func.max(Meal.sort_order)).where(Meal.date == payload.date)
    ).first() or 0
    new_order = max_sort_order + 1
    new_name = f"Meal {new_order}"
    db_meal = Meal(date=payload.date, name=new_name, sort_order=new_order)
    session.add(db_meal)
    session.commit()
    session.refresh(db_meal)
    return db_meal

@router.patch("/api/meals/{meal_id}", response_model=Meal)
def update_meal(meal_id: int, payload: MealUpdate, session: Session = Depends(get_session)):
    meal = session.get(Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    updated = False
    if payload.sort_order is not None and payload.sort_order != meal.sort_order:
        new_order = max(1, payload.sort_order)
        meals_same_day = session.exec(
            select(Meal).where(Meal.date == meal.date).order_by(Meal.sort_order)
        ).all()
        max_order = len(meals_same_day)
        if new_order > max_order:
            new_order = max_order
        old_order = meal.sort_order
        if new_order < old_order:
            affected = session.exec(
                select(Meal)
                .where(
                    Meal.date == meal.date,
                    Meal.sort_order >= new_order,
                    Meal.sort_order < old_order,
                    Meal.id != meal.id,
                )
            ).all()
            for m in affected:
                m.sort_order += 1
                if m.name.startswith("Meal "):
                    m.name = f"Meal {m.sort_order}"
                session.add(m)
        elif new_order > old_order:
            affected = session.exec(
                select(Meal)
                .where(
                    Meal.date == meal.date,
                    Meal.sort_order <= new_order,
                    Meal.sort_order > old_order,
                    Meal.id != meal.id,
                )
            ).all()
            for m in affected:
                m.sort_order -= 1
                if m.name.startswith("Meal "):
                    m.name = f"Meal {m.sort_order}"
                session.add(m)
        meal.sort_order = new_order
        if meal.name.startswith("Meal "):
            meal.name = f"Meal {new_order}"
        updated = True
    if payload.name is not None:
        meal.name = payload.name
        updated = True
    if updated:
        session.add(meal)
        session.commit()
        session.refresh(meal)
    return meal

@router.post("/api/entries", response_model=FoodEntry)
def create_entry(entry: FoodEntry, session: Session = Depends(get_session)):
    food = session.get(Food, entry.fdc_id)
    if not food or food.archived:
        raise HTTPException(status_code=404, detail="Food not available")
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry

def _scaled_from_food(f: Food, grams: float):
    factor = (grams or 0) / 100.0
    return (
        (f.kcal_per_100g or 0) * factor,
        (f.protein_g_per_100g or 0) * factor,
        (f.carb_g_per_100g or 0) * factor,
        (f.fat_g_per_100g or 0) * factor,
    )

@router.get("/api/days/{date}")
def get_day(date: str, session: Session = Depends(get_session)):
    meals = session.exec(select(Meal).where(Meal.date == date)).all()
    meal_ids = [m.id for m in meals]
    if not meal_ids:
        return {"meals": [], "entries": [], "totals": {"kcal": 0, "protein": 0, "fat": 0, "carb": 0}}
    entries = session.exec(select(FoodEntry).where(FoodEntry.meal_id.in_(meal_ids))).all()
    foods = {f.fdc_id: f for f in session.exec(select(Food).where(Food.fdc_id.in_({e.fdc_id for e in entries}))).all()}
    totals = {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}
    for e in entries:
        f = foods.get(e.fdc_id)
        if not f:
            continue
        kcal, p, c, fat = _scaled_from_food(f, e.quantity_g)
        totals["kcal"] += kcal
        totals["protein"] += p
        totals["carb"] += c
        totals["fat"] += fat
    return {"meals": meals, "entries": entries, "totals": {k: round(v, 2) for k, v in totals.items()}}

class EntryUpdate(BaseModel):
    quantity_g: Optional[float] = None

@router.patch("/api/entries/{entry_id}", response_model=FoodEntry)
def update_entry(entry_id: int, payload: EntryUpdate, session: Session = Depends(get_session)):
    e = session.get(FoodEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    if payload.quantity_g is not None:
        e.quantity_g = float(payload.quantity_g)
    session.add(e)
    session.commit()
    session.refresh(e)
    return e

@router.delete("/api/entries/{entry_id}")
def delete_entry(entry_id: int, session: Session = Depends(get_session)):
    e = session.get(FoodEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    session.delete(e)
    session.commit()
    return {"ok": True}

@router.get("/api/days/{date}/full")
async def get_day_full(date: str, session: Session = Depends(get_session)):
    meals = session.exec(select(Meal).where(Meal.date == date).order_by(Meal.sort_order)).all()
    meal_ids = [m.id for m in meals]
    if not meal_ids:
        return {"date": date, "meals": [], "totals": {"kcal": 0, "protein": 0, "fat": 0, "carb": 0}}
    entries = session.exec(select(FoodEntry).where(FoodEntry.meal_id.in_(meal_ids)).order_by(FoodEntry.id)).all()
    fdc_ids = list({e.fdc_id for e in entries if e.fdc_id is not None})
    foods: Dict[int, Food] = {}
    if fdc_ids:
        q = select(Food).where(Food.fdc_id.in_(fdc_ids))
        foods_list = session.exec(q).all()
        foods = {f.fdc_id: f for f in foods_list}
    def row_for_entry(e: FoodEntry):
        f = foods.get(e.fdc_id)
        if f is None:
            return {"id": e.id, "fdc_id": e.fdc_id, "description": "[deleted item]",
                    "quantity_g": e.quantity_g, "kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}
        kcal, p, c, fat = _scaled_from_food(f, e.quantity_g)
        return {"id": e.id, "fdc_id": e.fdc_id, "description": f.description, "quantity_g": e.quantity_g,
                "kcal": kcal, "protein": p, "carb": c, "fat": fat}
    by_meal: Dict[int, List[Dict]] = {m.id: [] for m in meals}
    for e in entries:
        by_meal[e.meal_id].append(row_for_entry(e))
    totals = {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}
    meals_out = []
    for m in meals:
        m_entries = by_meal.get(m.id, [])
        sub = {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}
        for x in m_entries:
            for k in sub:
                sub[k] += x[k]
        for k in totals:
            totals[k] += sub[k]
        meals_out.append({"id": m.id, "name": m.name, "date": m.date, "sort_order": m.sort_order,
                          "entries": m_entries, "subtotal": {k: round(v, 2) for k, v in sub.items()}})
    return {"date": date, "meals": meals_out, "totals": {k: round(v, 2) for k, v in totals.items()}}

@router.get("/api/export")
def export_csv(start: str = Query(..., description="YYYY-MM-DD"),
               end: str   = Query(..., description="YYYY-MM-DD"),
               session: Session = Depends(get_session)):
    meals = session.exec(select(Meal).where(Meal.date >= start, Meal.date <= end)).all()
    if not meals:
        return Response(content="date,meal,item,grams,kcal,protein,carb,fat\n", media_type="text/csv")
    meals_by_id = {m.id: m for m in meals}
    entries = session.exec(select(FoodEntry).where(FoodEntry.meal_id.in_(list(meals_by_id.keys())))
                           .order_by(FoodEntry.id)).all()
    foods = {f.fdc_id: f for f in session.exec(select(Food).where(Food.fdc_id.in_({e.fdc_id for e in entries}))).all()}
    buf = io.StringIO(); w = csv.writer(buf)
    w.writerow(["date", "meal", "item", "grams", "kcal", "protein", "carb", "fat"])
    sorted_entries = sorted(
        entries,
        key=lambda x: (meals_by_id[x.meal_id].date, meals_by_id[x.meal_id].sort_order, x.id or 0)
    )
    for e in sorted_entries:
        f = foods.get(e.fdc_id)
        if not f:
            continue
        kcal, p, c, fat = _scaled_from_food(f, e.quantity_g)
        w.writerow([meals_by_id[e.meal_id].date, meals_by_id[e.meal_id].name, f.description, e.quantity_g,
                    kcal, p, c, fat])
    csv_bytes = buf.getvalue().encode("utf-8")
    filename = f"macro_export_{start}_to_{end}.csv"
    return Response(content=csv_bytes, media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})

@router.delete("/api/meals/{meal_id}")
async def delete_meal(meal_id: int, session: Session = Depends(get_session)):
    meal_to_delete = session.get(Meal, meal_id)
    if not meal_to_delete:
        raise HTTPException(status_code=404, detail="Meal not found")
    has_entries = session.exec(select(FoodEntry).where(FoodEntry.meal_id == meal_id).limit(1)).first()
    if has_entries:
        raise HTTPException(
            status_code=409,
            detail="Meal has entries – delete or move them first.",
        )
    deleted_sort_order = meal_to_delete.sort_order
    day_date = meal_to_delete.date
    session.delete(meal_to_delete)
    session.commit()
    meals_to_renumber = session.exec(
        select(Meal)
        .where(Meal.date == day_date, Meal.sort_order > deleted_sort_order)
        .order_by(Meal.sort_order)
    ).all()
    for meal in meals_to_renumber:
        new_order = meal.sort_order - 1
        meal.sort_order = new_order
        meal.name = f"Meal {new_order}"
        session.add(meal)
    if meals_to_renumber:
        session.commit()
    return {"deleted": True}

class CopyToMealPayload(BaseModel):
    date: str
    meal_name: str

@router.post("/api/meals/{source_meal_id}/copy_to", status_code=201)
async def copy_meal_to(
    source_meal_id: int,
    payload: CopyToMealPayload,
    session: Session = Depends(get_session),
):
    source_meal = session.get(Meal, source_meal_id)
    if not source_meal:
        raise HTTPException(status_code=404, detail="Source meal not found")
    source_entries = session.exec(
        select(FoodEntry).where(FoodEntry.meal_id == source_meal_id)
    ).all()
    if not source_entries:
        return {"message": "Source meal has no entries to copy.", "added_count": 0}
    dest_meal = get_or_create_meal(session, payload.date, payload.meal_name)
    food_ids_to_cache = {e.fdc_id for e in source_entries}
    for fdc_id in food_ids_to_cache:
        await ensure_food_cached(fdc_id, session)
    for entry in source_entries:
        new_entry = FoodEntry(
            meal_id=dest_meal.id,
            fdc_id=entry.fdc_id,
            quantity_g=entry.quantity_g
        )
        session.add(new_entry)
    session.commit()
    return {"message": "Meal copied successfully.", "added_count": len(source_entries)}
