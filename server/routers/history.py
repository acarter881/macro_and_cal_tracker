from datetime import date, timedelta
from typing import Dict

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from server.db import get_session
from server.models import Meal, FoodEntry, Food, BodyWeight

router = APIRouter()


def _scaled_from_food(f: Food, grams: float):
    factor = (grams or 0) / 100.0
    return (
        (f.kcal_per_100g or 0) * factor,
        (f.protein_g_per_100g or 0) * factor,
        (f.carb_g_per_100g or 0) * factor,
        (f.fat_g_per_100g or 0) * factor,
    )


@router.get("/api/history")
def get_history(start_date: date, end_date: date, session: Session = Depends(get_session)):
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()
    meals = session.exec(
        select(Meal).where(Meal.date >= start_str, Meal.date <= end_str)
    ).all()
    meal_map = {m.id: m for m in meals}
    meal_ids = list(meal_map.keys())

    entries = []
    foods: Dict[int, Food] = {}
    if meal_ids:
        entries = session.exec(
            select(FoodEntry).where(FoodEntry.meal_id.in_(meal_ids))
        ).all()
        fdc_ids = {e.fdc_id for e in entries}
        if fdc_ids:
            foods = {
                f.fdc_id: f
                for f in session.exec(select(Food).where(Food.fdc_id.in_(fdc_ids))).all()
            }

    weights = session.exec(
        select(BodyWeight).where(
            BodyWeight.date >= start_str, BodyWeight.date <= end_str
        )
    ).all()
    weight_map = {w.date: w.weight for w in weights}

    totals: Dict[str, Dict[str, float]] = {}
    for e in entries:
        meal = meal_map.get(e.meal_id)
        if not meal:
            continue
        day = meal.date
        if day not in totals:
            totals[day] = {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}
        food = foods.get(e.fdc_id)
        if not food:
            continue
        kcal, p, c, fat = _scaled_from_food(food, e.quantity_g)
        totals[day]["kcal"] += kcal
        totals[day]["protein"] += p
        totals[day]["carb"] += c
        totals[day]["fat"] += fat

    out = []
    cur = start_date
    while cur <= end_date:
        day = cur.isoformat()
        t = totals.get(day, {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0})
        out.append(
            {
                "date": day,
                "kcal": round(t["kcal"], 2),
                "protein": round(t["protein"], 2),
                "carb": round(t["carb"], 2),
                "fat": round(t["fat"], 2),
                "weight": weight_map.get(day),
            }
        )
        cur += timedelta(days=1)

    return out
