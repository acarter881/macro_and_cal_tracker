from typing import Optional, List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, delete
from sqlalchemy import func
from pydantic import BaseModel, field_validator

from server.db import get_session
from server.models import Food, FoodEntry, Favorite
from server import utils

USDA_BASE = utils.USDA_BASE
fetch_food_detail = utils.fetch_food_detail
ensure_food_cached = utils.ensure_food_cached

router = APIRouter()

@router.get("/api/foods/search")
async def foods_search(q: str, dataType: Optional[str] = None):
    if not utils.USDA_KEY:
        raise HTTPException(status_code=500, detail="USDA_KEY not set")
    params: dict = {
        "api_key": utils.USDA_KEY,
        "query": q,
        "pageSize": 50,
        "requireAllWords": True,
    }
    if dataType and dataType.lower() != "all":
        params["dataType"] = [s.strip() for s in dataType.split(",") if s.strip()]
    async with httpx.AsyncClient(timeout=12.0) as client:
        r = await client.get(f"{USDA_BASE}/foods/search", params=params)
        r.raise_for_status()
        data = r.json()
    return {"results": [
        {"fdcId": i.get("fdcId"), "description": i.get("description"),
         "brandOwner": i.get("brandOwner"), "dataType": i.get("dataType")}
        for i in data.get("foods", [])
    ]}

@router.get("/api/foods/{fdc_id}")
async def foods_get(fdc_id: int, session: Session = Depends(get_session), refresh: bool = False):
    if not refresh:
        food = session.get(Food, fdc_id)
        if food:
            if getattr(food, "archived", 0):
                raise HTTPException(status_code=404, detail="Food archived")
            return food
    if fdc_id < 0:
        raise HTTPException(status_code=404, detail="Custom food not found")
    data = await fetch_food_detail(fdc_id)
    try:
        abridge_url = (f"https://api.nal.usda.gov/fdc/v1/foods?api_key={utils.USDA_KEY}&format=abridged&fdcIds={fdc_id}&nutrients=1008,1004,1003,1005")
        async with httpx.AsyncClient() as client:
            resp = await client.get(abridge_url)
            resp.raise_for_status()
            abr = resp.json()[0]
        abr_fn = abr.get("foodNutrients") or []
    except Exception as e:
        print(f"⚠️  Abridged fetch failed ({e}), falling back to full foodNutrients")
        abr_fn = []
    full_fn = data.get("foodNutrients") or []
    fn = abr_fn if abr_fn else full_fn
    nut_map: dict[int, float] = {}
    for item in fn:
        nid = None
        if "nutrientId" in item:
            nid = item["nutrientId"]
        elif isinstance(item.get("nutrient"), dict):
            nid = item["nutrient"].get("id") or item["nutrient"].get("nutrientId")
        if nid is None:
            continue
        amt = item.get("amount", item.get("value"))
        if amt is None and isinstance(item.get("nutrient"), dict):
            amt = item["nutrient"].get("value")
        try:
            nut_map[nid] = float(amt or 0)
        except:
            nut_map[nid] = 0.0
    lbl = data.get("labelNutrients") or {}
    fat     = nut_map.get(1085) or nut_map.get(1004) or float(lbl.get("fat", {}).get("value", 0))
    protein = nut_map.get(1003) or float(lbl.get("protein", {}).get("value", 0))
    carb    = nut_map.get(1005) or float(lbl.get("carbohydrates", {}).get("value", 0))
    kcal    = nut_map.get(1008) or float(lbl.get("calories", {}).get("value", 0))
    if kcal == 0 and (fat or protein or carb):
        kcal = round(fat * 9 + protein * 4 + carb * 4, 2)
    macros = {"kcal": kcal, "protein": protein, "fat": fat, "carb": carb}
    values = dict(
        fdc_id=fdc_id,
        description    = data.get("description") or data.get("descriptionShort") or "Unknown",
        brand_owner    = data.get("brandOwner"),
        data_type      = data.get("dataType") or data.get("dataCategory"),
        kcal_per_100g      = float(macros["kcal"]),
        protein_g_per_100g = float(macros["protein"]),
        carb_g_per_100g    = float(macros["carb"]),
        fat_g_per_100g     = float(macros["fat"]),
    )
    existing = session.get(Food, fdc_id)
    if existing:
        for k, v in values.items():
            setattr(existing, k, v)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        food = Food(**values)
        session.add(food)
        session.commit()
        session.refresh(food)
        return food

class FavoriteIn(BaseModel):
    fdc_id: int
    alias: Optional[str] = None
    default_grams: Optional[float] = None

@router.get("/api/favorites")
def list_favorites(session: Session = Depends(get_session)):
    favs = session.exec(select(Favorite)).all()
    if not favs:
        return {"items": []}
    food_map = {f.fdc_id: f for f in session.exec(select(Food).where(Food.fdc_id.in_([x.fdc_id for x in favs]))).all()}
    items = []
    for f in favs:
        food = food_map.get(f.fdc_id)
        items.append({
            "fdc_id": f.fdc_id, "alias": f.alias, "default_grams": f.default_grams,
            "description": food.description if food else f"FDC {f.fdc_id}",
            "brandOwner": getattr(food, "brand_owner", None) if food else None,
            "dataType": getattr(food, "data_type", None) if food else None,
        })
    return {"items": items}

@router.post("/api/favorites")
async def add_favorite(payload: FavoriteIn, session: Session = Depends(get_session)):
    fav = session.get(Favorite, payload.fdc_id)
    if fav:
        if payload.alias is not None:
            fav.alias = payload.alias
        if payload.default_grams is not None:
            fav.default_grams = float(payload.default_grams)
        session.add(fav)
        session.commit()
        return {"ok": True}
    fav = Favorite(fdc_id=payload.fdc_id,
                   alias=payload.alias,
                   default_grams=float(payload.default_grams) if payload.default_grams is not None else None)
    session.add(fav)
    await ensure_food_cached(payload.fdc_id, session)
    session.commit()
    return {"ok": True}

@router.delete("/api/favorites/{fdc_id}")
def remove_favorite(fdc_id: int, session: Session = Depends(get_session)):
    session.exec(delete(Favorite).where(Favorite.fdc_id == fdc_id))
    session.commit()
    return {"ok": True}

@router.get("/api/recents")
def list_recents(limit: int = 20, session: Session = Depends(get_session)):
    entries = session.exec(select(FoodEntry).order_by(FoodEntry.id.desc())).all()
    seen, out = set(), []
    for e in entries:
        if e.fdc_id in seen:
            continue
        seen.add(e.fdc_id)
        out.append(e.fdc_id)
        if len(out) >= limit:
            break
    if not out:
        return {"items": []}
    foods = {f.fdc_id: f for f in session.exec(select(Food).where(Food.fdc_id.in_(out))).all()}
    items = []
    for fid in out:
        f = foods.get(fid)
        if f:
            items.append({"fdc_id": fid, "description": f.description, "brandOwner": f.brand_owner, "dataType": f.data_type})
    return {"items": items}

class CustomFoodIn(BaseModel):
    description: str
    brand_owner: str | None = None
    kcal_per_100g: float
    protein_g_per_100g: float
    carb_g_per_100g: float
    fat_g_per_100g: float

    @field_validator("description")
    @classmethod
    def desc_not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Description is required.")
        return v

    @field_validator("kcal_per_100g", "protein_g_per_100g", "carb_g_per_100g", "fat_g_per_100g")
    @classmethod
    def non_negative(cls, v: float) -> float:
        if v is None or v < 0:
            raise ValueError("Macro values must be ≥ 0.")
        return float(v)

class CustomFoodUpdate(BaseModel):
    description: Optional[str] = None
    brand_owner: Optional[str] = None
    kcal_per_100g: Optional[float] = None
    protein_g_per_100g: Optional[float] = None
    carb_g_per_100g: Optional[float] = None
    fat_g_per_100g: Optional[float] = None

@router.post("/api/custom_foods")
def create_custom_food(body: CustomFoodIn, session: Session = Depends(get_session)):
    desc = body.description.strip()
    brand = (body.brand_owner or "").strip() or None
    import time
    fdc_id = -int(time.time() * 1000)
    f = Food(
        fdc_id=fdc_id, description=desc, data_type="Custom", brand_owner=brand,
        kcal_per_100g=body.kcal_per_100g, protein_g_per_100g=body.protein_g_per_100g,
        carb_g_per_100g=body.carb_g_per_100g, fat_g_per_100g=body.fat_g_per_100g,
        archived=False,
    )
    session.add(f)
    session.commit()
    session.refresh(f)
    return f

@router.get("/api/custom_foods/search")
def search_custom_foods(q: str, session: Session = Depends(get_session)):
    q_like = f"%{q.strip()}%"
    rows = session.exec(
        select(Food).where(Food.data_type == "Custom", Food.archived == False, Food.description.ilike(q_like))
        .order_by(Food.description).limit(50)
    ).all()
    return [{"fdcId": r.fdc_id, "description": r.description, "brandOwner": r.brand_owner, "dataType": r.data_type} for r in rows]

@router.patch("/api/custom_foods/{fdc_id}")
def update_custom_food(fdc_id: int, payload: CustomFoodUpdate, session: Session = Depends(get_session)):
    food = session.get(Food, fdc_id)
    if not food or food.data_type != "Custom":
        raise HTTPException(status_code=404, detail="Custom food not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(food, field, value if value != "" else None)
    session.add(food)
    session.commit()
    session.refresh(food)
    return {"ok": True}

@router.delete("/api/custom_foods/{fdc_id}")
def delete_custom_food(fdc_id: int, session: Session = Depends(get_session)):
    food = session.get(Food, fdc_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found.")
    if food.data_type != "Custom":
        raise HTTPException(status_code=400, detail="Only custom foods can be deleted here.")
    cnt = session.exec(select(func.count()).select_from(FoodEntry).where(FoodEntry.fdc_id == fdc_id)).one()
    if cnt and cnt[0] > 0:
        raise HTTPException(status_code=409, detail="This food is used in logged entries. Remove it from logs first.")
    session.delete(food)
    session.commit()
    return {"ok": True}

@router.get("/api/my_foods")
def my_foods(session: Session = Depends(get_session)):
    rows = session.exec(select(Food).where(Food.data_type == "Custom", Food.archived == False).order_by(Food.description)).all()
    return [{"fdcId": f.fdc_id, "description": f.description, "brandOwner": f.brand_owner, "dataType": f.data_type or "Custom"} for f in rows]
