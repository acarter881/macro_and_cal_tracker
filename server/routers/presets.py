from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, delete
from sqlalchemy import func
from pydantic import BaseModel

try:
    from ..db import get_session
    from ..models import Preset, PresetItem, Food, Meal, FoodEntry
    from ..utils import get_or_create_meal, ensure_food_cached
except ImportError:  # pragma: no cover
    from db import get_session
    from models import Preset, PresetItem, Food, Meal, FoodEntry
    from utils import get_or_create_meal, ensure_food_cached

router = APIRouter()

class PresetItemIn(BaseModel):
    fdc_id: int
    grams: float

class PresetCreate(BaseModel):
    name: str
    items: List[PresetItemIn]

class PresetFromMeal(BaseModel):
    name: str
    date: str
    meal_name: str

class PresetApply(BaseModel):
    date: str
    meal_name: str
    multiplier: float | None = 1.0

@router.get("/api/presets")
def list_presets(session: Session = Depends(get_session)):
    presets = session.exec(select(Preset).order_by(Preset.name)).all()
    if not presets:
        return {"items": []}
    counts = {p.id: 0 for p in presets if p.id is not None}
    if counts:
        for pi in session.exec(select(PresetItem)):
            if pi.preset_id in counts:
                counts[pi.preset_id] += 1
    return {"items": [{"id": p.id, "name": p.name, "item_count": counts.get(p.id, 0)} for p in presets]}

@router.get("/api/presets/{preset_id}")
def get_preset_detail(preset_id: int, session: Session = Depends(get_session)):
    p = session.get(Preset, preset_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preset not found")
    items = session.exec(select(PresetItem).where(PresetItem.preset_id == preset_id)).all()
    fids = [it.fdc_id for it in items]
    foods = {f.fdc_id: f for f in session.exec(select(Food).where(Food.fdc_id.in_(fids))).all()}
    return {"id": p.id, "name": p.name,
            "items": [{"fdc_id": it.fdc_id, "grams": it.grams,
                       "description": (foods.get(it.fdc_id).description if foods.get(it.fdc_id) else f"FDC {it.fdc_id}")} for it in items]}

@router.post("/api/presets")
def create_preset(payload: PresetCreate, session: Session = Depends(get_session)):
    p = session.exec(select(Preset).where(Preset.name == payload.name)).first()
    if not p:
        p = Preset(name=payload.name)
        session.add(p)
        session.commit()
        session.refresh(p)
    else:
        session.exec(delete(PresetItem).where(PresetItem.preset_id == p.id))
        session.commit()
    for it in payload.items:
        session.add(PresetItem(preset_id=p.id, fdc_id=it.fdc_id, grams=float(it.grams)))
    session.commit()
    return {"id": p.id, "name": p.name}

@router.post("/api/presets/from_meal")
def create_preset_from_meal(payload: PresetFromMeal, session: Session = Depends(get_session)):
    m = session.exec(select(Meal).where(Meal.date == payload.date, Meal.name == payload.meal_name)).first()
    if not m:
        raise HTTPException(status_code=404, detail="Meal not found")
    entries = session.exec(select(FoodEntry).where(FoodEntry.meal_id == m.id)).all()
    data = PresetCreate(name=payload.name, items=[PresetItemIn(fdc_id=e.fdc_id, grams=e.quantity_g) for e in entries])
    return create_preset(data, session)

@router.post("/api/presets/{preset_id}/apply")
async def apply_preset(preset_id: int, payload: PresetApply, session: Session = Depends(get_session)):
    p = session.get(Preset, preset_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preset not found")
    items = session.exec(select(PresetItem).where(PresetItem.preset_id == preset_id)).all()
    if not items:
        return {"ok": True, "entries": 0}
    m = get_or_create_meal(session, payload.date, payload.meal_name)
    mult = float(payload.multiplier or 1.0)
    for it in items:
        await ensure_food_cached(it.fdc_id, session)
        max_order = session.exec(select(func.max(FoodEntry.sort_order)).where(FoodEntry.meal_id == m.id)).first() or 0
        session.add(FoodEntry(meal_id=m.id, fdc_id=it.fdc_id, quantity_g=it.grams * mult, sort_order=max_order + 1))
    session.commit()
    return {"ok": True, "meal_id": m.id, "added": len(items)}

class PresetRename(BaseModel):
    name: str

@router.patch("/api/presets/{preset_id}")
def rename_preset(preset_id: int, payload: PresetRename, session: Session = Depends(get_session)):
    p = session.get(Preset, preset_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preset not found")
    p.name = payload.name
    session.add(p)
    session.commit()
    session.refresh(p)
    return {"id": p.id, "name": p.name}

class PresetItemsUpdate(BaseModel):
    items: List[PresetItemIn]

@router.patch("/api/presets/{preset_id}/items")
def update_preset_items(preset_id: int, payload: PresetItemsUpdate, session: Session = Depends(get_session)):
    if not session.get(Preset, preset_id):
        raise HTTPException(status_code=404, detail="Preset not found")
    session.exec(delete(PresetItem).where(PresetItem.preset_id == preset_id))
    session.commit()
    for it in payload.items:
        session.add(PresetItem(preset_id=preset_id, fdc_id=it.fdc_id, grams=float(it.grams)))
    session.commit()
    return {"ok": True}

@router.delete("/api/presets/{preset_id}", response_model=dict)
def delete_preset(preset_id: int, session: Session = Depends(get_session)):
    p = session.get(Preset, preset_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preset not found")
    session.exec(delete(PresetItem).where(PresetItem.preset_id == preset_id))
    session.delete(p)
    session.commit()
    return {"deleted": True}
