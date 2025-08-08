from fastapi import FastAPI, Depends, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Field, Session, create_engine, select, delete, col
from sqlalchemy import UniqueConstraint, Column, Boolean, func, text
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from typing import Optional, List, Dict
import os, asyncio, io, csv, httpx
from datetime import date as _date, date, timedelta
import httpx

# -------------------------------------------------------------------
# DB setup
# -------------------------------------------------------------------
DATABASE_URL = "sqlite:///./foodlog.db"
engine = create_engine(DATABASE_URL, echo=False)

# -------------------------------------------------------------------
# Models
# -------------------------------------------------------------------
class Food(SQLModel, table=True):
    fdc_id: int = Field(primary_key=True)
    description: str
    brand_owner: Optional[str] = None
    data_type: Optional[str] = None
    # per-100g
    kcal_per_100g: float
    protein_g_per_100g: float
    fat_g_per_100g: float
    carb_g_per_100g: float
    archived: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, server_default="0"))

class Meal(SQLModel, table=True):
    # REFACTOR: The unique constraint is now on date and sort_order.
    # The name is for display only and can be changed later without breaking logic.
    __table_args__ = (UniqueConstraint("date", "sort_order", name="uq_meal_date_sort_order"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str
    name: str
    # REFACTOR: Added a sort_order column to reliably order meals for a day.
    sort_order: int = Field(index=True)


class FoodEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    meal_id: int = Field(foreign_key="meal.id")
    fdc_id: int = Field(foreign_key="food.fdc_id")
    quantity_g: float

class Favorite(SQLModel, table=True):
    fdc_id: int = Field(primary_key=True)
    alias: Optional[str] = None
    default_grams: Optional[float] = None

class Preset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)

class PresetItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    preset_id: int = Field(foreign_key="preset.id")
    fdc_id: int
    grams: float

# -------------------------------------------------------------------
# App + startup
# -------------------------------------------------------------------
app = FastAPI(title="Macro Tracker API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only; tighten for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_session():
    with Session(engine) as session:
        yield session

def ensure_meal_sort_order_column(session: Session):
    # Ensures existing databases have the new sort_order column
    tbl = session.exec(text("SELECT name FROM sqlite_master WHERE type='table' AND name='meal'")).first()
    if not tbl: return
    cols = session.exec(text("PRAGMA table_info(meal)")).all()
    names = {row[1] for row in cols}
    if "sort_order" not in names:
        session.exec(text("ALTER TABLE meal ADD COLUMN sort_order INTEGER"))
        session.commit()
        # Backfill sort_order based on name for old data
        meals = session.exec(select(Meal).where(Meal.sort_order.is_(None))).all()
        for m in meals:
            try:
                num = int(m.name.replace("Meal", "").strip())
                m.sort_order = num
                session.add(m)
            except:
                # If name isn't "Meal X", assign a high sort order
                m.sort_order = 99
                session.add(m)
        session.commit()

def ensure_food_archived_column(session: Session):
    tbl = session.exec(text("SELECT name FROM sqlite_master WHERE type='table' AND name='food'")).first()
    if not tbl: return
    cols = session.exec(text("PRAGMA table_info(food)")).all()
    names = {row[1] for row in cols}
    if "archived" not in names:
        session.exec(text("ALTER TABLE food ADD COLUMN archived INTEGER NOT NULL DEFAULT 0"))
        session.commit()

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        ensure_food_archived_column(s)
        ensure_meal_sort_order_column(s)

# -------------------------------------------------------------------
# USDA helpers
# ... (This entire section is unchanged)
# -------------------------------------------------------------------
USDA_BASE = "https://api.nal.usda.gov/fdc/v1"
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())
USDA_KEY = os.getenv("USDA_KEY")
if not USDA_KEY:
    raise RuntimeError("USDA_KEY not set — add it to your system env or a .env file.")

def _to_float(x):
    try:
        return float(x)
    except Exception:
        return 0.0


def extract_macros_from_fdc(data: dict) -> dict[str, float]:
    """
    Returns per-100 g macros in label terms:
      - 'carb' is TOTAL carbohydrate (includes fiber)
      - kcal uses label energy if present; otherwise 4/4/9 with fiber @ 2 kcal/g
      - If 'Carbohydrate, by difference' is missing, try:
          (a) sugars + starch + fiber
          (b) by-difference from proximates: 100 - water - protein - fat - ash - alcohol
      - Fiber detection is lenient (total/soluble/insoluble and various names)
    """
    out = {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}

    # components for fallbacks
    sugars = None
    starch = None
    fiber_total = None
    fiber_sol  = None
    fiber_ins  = None
    fiber_any  = None  # any fiber string if total/sol/ins not matched
    water = None
    ash = None
    alcohol = None

    # --- 1) labelNutrients (branded/label data) ---
    lbl = (data or {}).get("labelNutrients") or None
    if lbl:
        def lv(k):
            v = lbl.get(k) or {}
            return v.get("value")
        if (v := lv("calories"))      is not None: out["kcal"]    = _to_float(v)
        if (v := lv("protein"))       is not None: out["protein"] = _to_float(v)
        if (v := lv("fat"))           is not None: out["fat"]     = _to_float(v)
        if (v := lv("carbohydrates")) is not None: out["carb"]    = _to_float(v)
        # some labels expose fiber/sugars here
        if (v := lv("fiber"))         is not None: fiber_total    = _to_float(v)
        if (v := lv("sugars"))        is not None: sugars         = _to_float(v)

    # --- 2) foodNutrients (Foundation / SR Legacy / Survey) ---
    for n in data.get("foodNutrients") or []:
        amt = n.get("amount")
        if amt is None:
            continue
        nut = n.get("nutrient") or {}
        name = (nut.get("name") or n.get("name") or "").strip().lower()

        # Nutrient number can appear in multiple fields and sometimes like "269.3"
        num_raw = (
            nut.get("number")
            or n.get("nutrientNumber")
            or n.get("nutrientId")
            or nut.get("id")
        )
        num = None
        if num_raw is not None:
            try:
                num = int(float(str(num_raw)))
            except Exception:
                num = None

        a = _to_float(amt)

        # Energy (kcal)
        if num in (1008, 208) or name.startswith("energy"):
            if out["kcal"] == 0.0:
                out["kcal"] = a
            continue

        # Protein, Fat, Carbohydrate by difference
        if num == 203 or name == "protein":
            out["protein"] = a;  continue
        if num == 204 or name == "total lipid (fat)":
            out["fat"] = a;      continue
        if num in (1005, 205) or name == "carbohydrate, by difference":
            out["carb"] = a;     continue

        # Sugars / Starch
        if num == 269 or "sugars" in name:
            # accept any "sugars, total" & similar
            sugars = a;          continue
        if num == 1009 or name.startswith("starch"):
            starch = a;          continue

        # Fiber variants:
        #  - Total dietary fiber: 1079 (modern) or 291 (legacy)
        #  - Soluble: 1082; Insoluble: 1084 (numbers vary by release)
        #  - Names vary: "fiber, total dietary", "total dietary fiber", "dietary fiber", "fiber, soluble", etc.
        if num in (1079, 291) or ("fiber" in name and ("total" in name or "dietary" in name)):
            fiber_total = a;     continue
        if num in (1082,) or ("fiber" in name and "soluble" in name):
            fiber_sol = a;       continue
        if num in (1084,) or ("fiber" in name and "insoluble" in name):
            fiber_ins = a;       continue
        if "fiber" in name:
            # catch-all if an unusual fiber name appears
            fiber_any = a;       continue

        # Proximates for by-difference fallback
        if num == 255 or name == "water":
            water = a;           continue
        if num == 207 or name == "ash":
            ash = a;             continue
        if num == 221 or "alcohol" in name:
            alcohol = a;         continue

    # Choose the best fiber value we have
    fiber = None
    if fiber_total is not None:
        fiber = fiber_total
    elif fiber_sol is not None or fiber_ins is not None:
        fiber = (fiber_sol or 0.0) + (fiber_ins or 0.0)
    elif fiber_any is not None:
        fiber = fiber_any

    # --- 3a) If total carb still missing, approximate from sugars+starch+fiber ---
    if (out["carb"] or 0.0) == 0.0:
        comp_sum = sum(x for x in (sugars, starch, fiber) if x is not None)
        if comp_sum:
            out["carb"] = comp_sum

    # --- 3b) If still missing, compute carb by difference from proximates ---
    if (out["carb"] or 0.0) == 0.0 and (water is not None and ash is not None):
        out["carb"] = max(
            0.0,
            100.0
            - (water or 0.0)
            - (out["protein"] or 0.0)
            - (out["fat"] or 0.0)
            - (ash or 0.0)
            - (alcohol or 0.0)
        )

    # --- 4) If kcal missing, compute with fiber at 2 kcal/g ---
    if (out["kcal"] or 0.0) == 0.0:
        c_total = out["carb"] or 0.0
        f_total = fiber or 0.0
        digestible = max(0.0, c_total - f_total)  # sugars + starch ≈ digestible carbs
        out["kcal"] = round(
            out["protein"] * 4 + digestible * 4 + f_total * 2 + out["fat"] * 9, 2
        )

    # Normalize
    for k in out:
        out[k] = _to_float(out[k])

    return out

async def fetch_food_detail(fdc_id: int) -> dict:
    if not USDA_KEY:
        raise HTTPException(status_code=500, detail="USDA_KEY is not set on the server")
    url = f"{USDA_BASE}/food/{fdc_id}"
    params = {"api_key": USDA_KEY}
    exceptions_to_retry = (
        httpx.ReadTimeout, httpx.ConnectTimeout, httpx.ReadError,
        httpx.RemoteProtocolError, httpx.ConnectError, httpx.NetworkError
    )
    async with httpx.AsyncClient(timeout=20.0, headers={"Accept": "application/json"}) as client:
        for attempt in range(3):
            try:
                r = await client.get(url, params=params)
                if r.status_code == 200:
                    try: return r.json()
                    except Exception as e:
                        raise HTTPException(status_code=502, detail=f"USDA JSON decode error: {e!s}")
                raise HTTPException(status_code=r.status_code, detail=f"USDA error {r.status_code}: {r.text[:400]}")
            except exceptions_to_retry as e:
                if attempt == 2:
                    raise HTTPException(status_code=502, detail=f"USDA network error: {e!s}")
                await asyncio.sleep(0.4 * (attempt + 1))

async def ensure_food_cached(fdc_id: int, session: Session) -> Food:
    # ... (This function is unchanged)
    food = session.get(Food, fdc_id)
    if food:
        return food
    food_json = await fetch_food_detail(fdc_id)
    macros = extract_macros_from_fdc(food_json)
    food = Food(
        fdc_id=fdc_id,
        description=food_json.get("description", f"FDC {fdc_id}"),
        brand_owner=food_json.get("brandOwner"),
        data_type=food_json.get("dataType"),
        kcal_per_100g=macros["kcal"],
        protein_g_per_100g=macros["protein"],
        fat_g_per_100g=macros["fat"],
        carb_g_per_100g=macros["carb"],
    )
    session.add(food); session.commit(); session.refresh(food)
    return food

# REFACTOR: Updated to handle creation with sort_order if meal doesn't exist
def get_or_create_meal(session: Session, date: str, name: str) -> Meal:
    m = session.exec(select(Meal).where(Meal.date == date, Meal.name == name)).first()
    if m:
        return m
    
    # If creating, we must determine the correct sort_order
    max_sort_order = session.exec(
        select(func.max(Meal.sort_order)).where(Meal.date == date)
    ).first() or 0
    new_order = max_sort_order + 1

    m = Meal(date=date, name=name, sort_order=new_order)
    session.add(m)
    session.commit()
    session.refresh(m)
    return m

# -------------------------------------------------------------------
# Foods search / get
# ... (This entire section is unchanged)
# -------------------------------------------------------------------
@app.get("/api/foods/search")
async def foods_search(q: str, dataType: Optional[str] = None):
    if not USDA_KEY:
        raise HTTPException(status_code=500, detail="USDA_KEY not set")
    params: dict = {
        "api_key": USDA_KEY,
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

@app.get("/api/foods/{fdc_id}")
async def foods_get(fdc_id: int, session: Session = Depends(get_session), refresh: bool = False):
    # ... (This function is unchanged)
    if not refresh:
        food = session.get(Food, fdc_id)
        if food:
            if getattr(food, "archived", 0): raise HTTPException(status_code=404, detail="Food archived")
            return food
    if fdc_id < 0: raise HTTPException(status_code=404, detail="Custom food not found")
    data = await fetch_food_detail(fdc_id)
    try:
        abridge_url = (f"https://api.nal.usda.gov/fdc/v1/foods?api_key={USDA_KEY}&format=abridged&fdcIds={fdc_id}&nutrients=1008,1004,1003,1005")
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
        if "nutrientId" in item: nid = item["nutrientId"]
        elif isinstance(item.get("nutrient"), dict): nid = item["nutrient"].get("id") or item["nutrient"].get("nutrientId")
        if nid is None: continue
        amt = item.get("amount", item.get("value"))
        if amt is None and isinstance(item.get("nutrient"), dict): amt = item["nutrient"].get("value")
        try: nut_map[nid] = float(amt or 0)
        except: nut_map[nid] = 0.0
    lbl = data.get("labelNutrients") or {}
    fat     = nut_map.get(1085) or nut_map.get(1004) or float(lbl.get("fat", {}).get("value", 0))
    protein = nut_map.get(1003) or float(lbl.get("protein", {}).get("value", 0))
    carb    = nut_map.get(1005) or float(lbl.get("carbohydrates", {}).get("value", 0))
    kcal    = nut_map.get(1008) or float(lbl.get("calories", {}).get("value", 0))
    if kcal == 0 and (fat or protein or carb): kcal = round(fat * 9 + protein * 4 + carb * 4, 2)
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
        for k, v in values.items(): setattr(existing, k, v)
        session.add(existing); session.commit(); session.refresh(existing)
        return existing
    else:
        food = Food(**values); session.add(food); session.commit(); session.refresh(food)
        return food

# -------------------------------------------------------------------
# Meals & entries
# -------------------------------------------------------------------
# REFACTOR: This endpoint now only requires a date.
# It automatically calculates the correct sort_order and name.
class MealCreate(BaseModel):
    date: str

@app.post("/api/meals", response_model=Meal)
def create_meal(payload: MealCreate, session: Session = Depends(get_session)):
    # 1. Find the highest sort_order for the given date
    max_sort_order = session.exec(
        select(func.max(Meal.sort_order)).where(Meal.date == payload.date)
    ).first() or 0
    
    # 2. The new meal's order and name are determined sequentially
    new_order = max_sort_order + 1
    new_name = f"Meal {new_order}"

    # 3. Create and save the new meal
    db_meal = Meal(date=payload.date, name=new_name, sort_order=new_order)
    session.add(db_meal)
    session.commit()
    session.refresh(db_meal)
    return db_meal

@app.post("/api/entries", response_model=FoodEntry)
def create_entry(entry: FoodEntry, session: Session = Depends(get_session)):
    # ... (This function is unchanged)
    food = session.get(Food, entry.fdc_id)
    if not food or food.archived:
        raise HTTPException(status_code=404, detail="Food not available")
    session.add(entry); session.commit(); session.refresh(entry); return entry

def _scaled_from_food(f: Food, grams: float):
    # ... (This function is unchanged)
    factor = (grams or 0) / 100.0
    return (
        (f.kcal_per_100g or 0) * factor,
        (f.protein_g_per_100g or 0) * factor,
        (f.carb_g_per_100g or 0) * factor,
        (f.fat_g_per_100g or 0) * factor,
    )

@app.get("/api/days/{date}")
def get_day(date: str, session: Session = Depends(get_session)):
    # ... (This function is unchanged)
    meals = session.exec(select(Meal).where(Meal.date == date)).all()
    meal_ids = [m.id for m in meals]
    if not meal_ids: return {"meals": [], "entries": [], "totals": {"kcal": 0, "protein": 0, "fat": 0, "carb": 0}}
    entries = session.exec(select(FoodEntry).where(FoodEntry.meal_id.in_(meal_ids))).all()
    foods = {f.fdc_id: f for f in session.exec(select(Food).where(Food.fdc_id.in_({e.fdc_id for e in entries}))).all()}
    totals = {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}
    for e in entries:
        f = foods.get(e.fdc_id)
        if not f: continue
        kcal, p, c, fat = _scaled_from_food(f, e.quantity_g)
        totals["kcal"] += kcal; totals["protein"] += p; totals["carb"] += c; totals["fat"] += fat
    return {"meals": meals, "entries": entries, "totals": {k: round(v, 2) for k, v in totals.items()}}

class EntryUpdate(BaseModel):
    quantity_g: Optional[float] = None

@app.patch("/api/entries/{entry_id}", response_model=FoodEntry)
def update_entry(entry_id: int, payload: EntryUpdate, session: Session = Depends(get_session)):
    # ... (This function is unchanged)
    e = session.get(FoodEntry, entry_id)
    if not e: raise HTTPException(status_code=404, detail="Entry not found")
    if payload.quantity_g is not None: e.quantity_g = float(payload.quantity_g)
    session.add(e); session.commit(); session.refresh(e); return e

@app.delete("/api/entries/{entry_id}")
def delete_entry(entry_id: int, session: Session = Depends(get_session)):
    # ... (This function is unchanged)
    e = session.get(FoodEntry, entry_id)
    if not e: raise HTTPException(status_code=404, detail="Entry not found")
    session.delete(e); session.commit(); return {"ok": True}

@app.get("/api/days/{date}/full")
async def get_day_full(date: str, session: Session = Depends(get_session)):
    # REFACTOR: Meals are now ordered by their sort_order.
    meals = session.exec(select(Meal).where(Meal.date == date).order_by(Meal.sort_order)).all()
    meal_ids = [m.id for m in meals]
    if not meal_ids:
        return {"date": date, "meals": [], "totals": {"kcal": 0, "protein": 0, "fat": 0, "carb": 0}}

    entries = session.exec(select(FoodEntry).where(FoodEntry.meal_id.in_(meal_ids)).order_by(FoodEntry.id)).all()
    fdc_ids = list({e.fdc_id for e in entries if e.fdc_id is not None})
    
    foods: dict[int, Food] = {}
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
    for e in entries: by_meal[e.meal_id].append(row_for_entry(e))

    totals = {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}
    meals_out = []
    for m in meals:
        m_entries = by_meal.get(m.id, [])
        sub = {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}
        for x in m_entries:
            for k in sub: sub[k] += x[k]
        for k in totals: totals[k] += sub[k]
        # REFACTOR: The new `sort_order` field is added to the output.
        meals_out.append({"id": m.id, "name": m.name, "date": m.date, "sort_order": m.sort_order,
                          "entries": m_entries, "subtotal": {k: round(v, 2) for k, v in sub.items()}})
    return {"date": date, "meals": meals_out, "totals": {k: round(v, 2) for k, v in totals.items()}}

# -------------------------------------------------------------------
# CSV export
# -------------------------------------------------------------------
@app.get("/api/export")
def export_csv(start: str = Query(..., description="YYYY-MM-DD"),
               end: str   = Query(..., description="YYYY-MM-DD"),
               session: Session = Depends(get_session)):
    meals = session.exec(select(Meal).where(col(Meal.date) >= start, col(Meal.date) <= end)).all()
    if not meals:
        return Response(content="date,meal,item,grams,kcal,protein,carb,fat\n", media_type="text/csv")
    meals_by_id = {m.id: m for m in meals}
    entries = session.exec(select(FoodEntry).where(FoodEntry.meal_id.in_(list(meals_by_id.keys())))
                           .order_by(FoodEntry.id)).all()
    foods = {f.fdc_id: f for f in session.exec(select(Food).where(Food.fdc_id.in_({e.fdc_id for e in entries}))).all()}

    buf = io.StringIO(); w = csv.writer(buf)
    w.writerow(["date", "meal", "item", "grams", "kcal", "protein", "carb", "fat"])
    # REFACTOR: Sorting now uses the meal's sort_order instead of its name.
    sorted_entries = sorted(
        entries, 
        key=lambda x: (meals_by_id[x.meal_id].date, meals_by_id[x.meal_id].sort_order, x.id or 0)
    )
    for e in sorted_entries:
        f = foods.get(e.fdc_id)
        if not f: continue
        kcal, p, c, fat = _scaled_from_food(f, e.quantity_g)
        w.writerow([meals_by_id[e.meal_id].date, meals_by_id[e.meal_id].name, f.description, e.quantity_g,
                    kcal, p, c, fat])
    csv_bytes = buf.getvalue().encode("utf-8")
    filename = f"macro_export_{start}_to_{end}.csv"
    return Response(content=csv_bytes, media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})

# -------------------------------------------------------------------
# Favorites & Recents
# ... (This entire section is unchanged)
# -------------------------------------------------------------------
class FavoriteIn(SQLModel):
    fdc_id: int
    alias: Optional[str] = None
    default_grams: Optional[float] = None

@app.get("/api/favorites")
def list_favorites(session: Session = Depends(get_session)):
    favs = session.exec(select(Favorite)).all()
    if not favs: return {"items": []}
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

@app.post("/api/favorites")
async def add_favorite(payload: FavoriteIn, session: Session = Depends(get_session)):
    fav = session.get(Favorite, payload.fdc_id)
    if fav:
        if payload.alias is not None: fav.alias = payload.alias
        if payload.default_grams is not None: fav.default_grams = float(payload.default_grams)
        session.add(fav); session.commit(); return {"ok": True}
    fav = Favorite(fdc_id=payload.fdc_id,
                   alias=payload.alias,
                   default_grams=float(payload.default_grams) if payload.default_grams is not None else None)
    session.add(fav)
    await ensure_food_cached(payload.fdc_id, session)
    session.commit()
    return {"ok": True}

@app.delete("/api/favorites/{fdc_id}")
def remove_favorite(fdc_id: int, session: Session = Depends(get_session)):
    session.exec(delete(Favorite).where(Favorite.fdc_id == fdc_id)); session.commit(); return {"ok": True}

@app.get("/api/recents")
def list_recents(limit: int = 20, session: Session = Depends(get_session)):
    entries = session.exec(select(FoodEntry).order_by(FoodEntry.id.desc())).all()
    seen, out = set(), []
    for e in entries:
        if e.fdc_id in seen: continue
        seen.add(e.fdc_id); out.append(e.fdc_id)
        if len(out) >= limit: break
    if not out: return {"items": []}
    foods = {f.fdc_id: f for f in session.exec(select(Food).where(Food.fdc_id.in_(out))).all()}
    items = []
    for fid in out:
        f = foods.get(fid)
        if f:
            items.append({"fdc_id": fid, "description": f.description, "brandOwner": f.brand_owner, "dataType": f.data_type})
    return {"items": items}

# -------------------------------------------------------------------
# Presets (list/create/apply/rename/update/delete)
# ... (This entire section is unchanged except for get_or_create_meal call)
# -------------------------------------------------------------------
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

@app.get("/api/presets")
def list_presets(session: Session = Depends(get_session)):
    presets = session.exec(select(Preset).order_by(Preset.name)).all()
    if not presets: return {"items": []}
    counts = {p.id: 0 for p in presets if p.id is not None}
    if counts:
        for pi in session.exec(select(PresetItem)):
            if pi.preset_id in counts: counts[pi.preset_id] += 1
    return {"items": [{"id": p.id, "name": p.name, "item_count": counts.get(p.id, 0)} for p in presets]}

@app.get("/api/presets/{preset_id}")
def get_preset_detail(preset_id: int, session: Session = Depends(get_session)):
    p = session.get(Preset, preset_id)
    if not p: raise HTTPException(status_code=404, detail="Preset not found")
    items = session.exec(select(PresetItem).where(PresetItem.preset_id == preset_id)).all()
    fids = [it.fdc_id for it in items]
    foods = {f.fdc_id: f for f in session.exec(select(Food).where(Food.fdc_id.in_(fids))).all()}
    return {"id": p.id, "name": p.name,
            "items": [{"fdc_id": it.fdc_id, "grams": it.grams,
                       "description": (foods.get(it.fdc_id).description if foods.get(it.fdc_id) else f"FDC {it.fdc_id}")} for it in items]}

@app.post("/api/presets")
def create_preset(payload: PresetCreate, session: Session = Depends(get_session)):
    p = session.exec(select(Preset).where(Preset.name == payload.name)).first()
    if not p:
        p = Preset(name=payload.name); session.add(p); session.commit(); session.refresh(p)
    else:
        session.exec(delete(PresetItem).where(PresetItem.preset_id == p.id)); session.commit()
    for it in payload.items:
        session.add(PresetItem(preset_id=p.id, fdc_id=it.fdc_id, grams=float(it.grams)))
    session.commit()
    return {"id": p.id, "name": p.name}

@app.post("/api/presets/from_meal")
def create_preset_from_meal(payload: PresetFromMeal, session: Session = Depends(get_session)):
    m = session.exec(select(Meal).where(Meal.date == payload.date, Meal.name == payload.meal_name)).first()
    if not m: raise HTTPException(status_code=404, detail="Meal not found")
    entries = session.exec(select(FoodEntry).where(FoodEntry.meal_id == m.id)).all()
    data = PresetCreate(name=payload.name, items=[PresetItemIn(fdc_id=e.fdc_id, grams=e.quantity_g) for e in entries])
    return create_preset(data, session)

@app.post("/api/presets/{preset_id}/apply")
async def apply_preset(preset_id: int, payload: PresetApply, session: Session = Depends(get_session)):
    p = session.get(Preset, preset_id)
    if not p: raise HTTPException(status_code=404, detail="Preset not found")
    items = session.exec(select(PresetItem).where(PresetItem.preset_id == preset_id)).all()
    if not items: return {"ok": True, "entries": 0}
    m = get_or_create_meal(session, payload.date, payload.meal_name)
    mult = float(payload.multiplier or 1.0)
    for it in items:
        await ensure_food_cached(it.fdc_id, session)
        session.add(FoodEntry(meal_id=m.id, fdc_id=it.fdc_id, quantity_g=it.grams * mult))
    session.commit()
    return {"ok": True, "meal_id": m.id, "added": len(items)}

class PresetRename(BaseModel):
    name: str

@app.patch("/api/presets/{preset_id}")
def rename_preset(preset_id: int, payload: PresetRename, session: Session = Depends(get_session)):
    p = session.get(Preset, preset_id)
    if not p: raise HTTPException(status_code=404, detail="Preset not found")
    p.name = payload.name; session.add(p); session.commit(); session.refresh(p)
    return {"id": p.id, "name": p.name}

class PresetItemsUpdate(BaseModel):
    items: List[PresetItemIn]

@app.patch("/api/presets/{preset_id}/items")
def update_preset_items(preset_id: int, payload: PresetItemsUpdate, session: Session = Depends(get_session)):
    if not session.get(Preset, preset_id): raise HTTPException(status_code=404, detail="Preset not found")
    session.exec(delete(PresetItem).where(PresetItem.preset_id == preset_id)); session.commit()
    for it in payload.items:
        session.add(PresetItem(preset_id=preset_id, fdc_id=it.fdc_id, grams=float(it.grams)))
    session.commit()
    return {"ok": True}

# -------------------------------------------------------------------
# Custom foods (create/search/update/delete/list)
# ... (This entire section is unchanged)
# -------------------------------------------------------------------
def next_custom_id(session: Session) -> int:
    min_id = session.exec(select(func.min(Food.fdc_id))).first()
    if min_id is None or min_id >= 0: return -1
    return min_id - 1

from pydantic import field_validator

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
        if not v: raise ValueError("Description is required.")
        return v

    @field_validator("kcal_per_100g", "protein_g_per_100g", "carb_g_per_100g", "fat_g_per_100g")
    @classmethod
    def non_negative(cls, v: float) -> float:
        if v is None or v < 0: raise ValueError("Macro values must be ≥ 0.")
        return float(v)

class CustomFoodUpdate(BaseModel):
    description: Optional[str] = None
    brand_owner: Optional[str] = None
    kcal_per_100g: Optional[float] = None
    protein_g_per_100g: Optional[float] = None
    carb_g_per_100g: Optional[float] = None
    fat_g_per_100g: Optional[float] = None

@app.post("/api/custom_foods")
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
    session.add(f); session.commit(); session.refresh(f)
    return f

@app.get("/api/custom_foods/search")
def search_custom_foods(q: str, session: Session = Depends(get_session)):
    q_like = f"%{q.strip()}%"
    rows = session.exec(
        select(Food).where(Food.data_type == "Custom", Food.archived == False, Food.description.ilike(q_like))
        .order_by(Food.description).limit(50)
    ).all()
    return [{"fdcId": r.fdc_id, "description": r.description, "brandOwner": r.brand_owner, "dataType": r.data_type} for r in rows]

@app.patch("/api/custom_foods/{fdc_id}")
def update_custom_food(fdc_id: int, payload: CustomFoodUpdate, session: Session = Depends(get_session)):
    food = session.get(Food, fdc_id)
    if not food or food.data_type != "Custom": raise HTTPException(status_code=404, detail="Custom food not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(food, field, value if value != "" else None)
    session.add(food); session.commit(); session.refresh(food); return {"ok": True}

@app.delete("/api/custom_foods/{fdc_id}")
def delete_custom_food(fdc_id: int, session: Session = Depends(get_session)):
    food = session.get(Food, fdc_id)
    if not food: raise HTTPException(status_code=404, detail="Food not found.")
    if food.data_type != "Custom": raise HTTPException(status_code=400, detail="Only custom foods can be deleted here.")
    cnt = session.exec(select(func.count()).select_from(FoodEntry).where(FoodEntry.fdc_id == fdc_id)).one()
    if cnt and cnt[0] > 0:
        raise HTTPException(status_code=409, detail="This food is used in logged entries. Remove it from logs first.")
    session.delete(food); session.commit()
    return {"ok": True}

@app.get("/api/my_foods")
def my_foods(session: Session = Depends(get_session)):
    rows = session.exec(select(Food).where(Food.data_type == "Custom", Food.archived == False).order_by(Food.description)).all()
    return [{"fdcId": f.fdc_id, "description": f.description, "brandOwner": f.brand_owner, "dataType": f.data_type or "Custom"} for f in rows]

@app.delete("/api/meals/{meal_id}")
async def delete_meal(meal_id: int, session: Session = Depends(get_session)):
    meal_to_delete = session.get(Meal, meal_id)
    if not meal_to_delete:
        raise HTTPException(status_code=404, detail="Meal not found")

    has_entries = session.exec(select(FoodEntry).where(FoodEntry.meal_id == meal_id).limit(1)).first()
    if has_entries:
        raise HTTPException(
            status_code=409,
            detail="Meal has entries – delete or move them first."
        )

    # Store details before deleting
    deleted_sort_order = meal_to_delete.sort_order
    day_date = meal_to_delete.date

    # Delete the target meal
    session.delete(meal_to_delete)
    session.commit()

    # **FIX**: Find all meals on the same day with a higher sort order
    meals_to_renumber = session.exec(
        select(Meal)
        .where(Meal.date == day_date, Meal.sort_order > deleted_sort_order)
        .order_by(Meal.sort_order)
    ).all()

    # Renumber them sequentially to fill the gap
    for meal in meals_to_renumber:
        new_order = meal.sort_order - 1
        meal.sort_order = new_order
        meal.name = f"Meal {new_order}"
        session.add(meal)

    # Commit the renumbering changes if any were made
    if meals_to_renumber:
        session.commit()

    return {"deleted": True}

@app.delete("/api/presets/{preset_id}", response_model=dict)
def delete_preset(preset_id: int, session: Session = Depends(get_session)):
    p = session.get(Preset, preset_id)
    if not p: raise HTTPException(status_code=404, detail="Preset not found")
    session.exec(delete(PresetItem).where(PresetItem.preset_id == preset_id))
    session.delete(p); session.commit()
    return {"deleted": True}

# --- NEW: Pydantic model for the copy/paste payload ---
class CopyToMealPayload(BaseModel):
    date: str
    meal_name: str

# --- NEW: Endpoint to copy entries from one meal to another ---
@app.post("/api/meals/{source_meal_id}/copy_to", status_code=201)
async def copy_meal_to(
    source_meal_id: int,
    payload: CopyToMealPayload,
    session: Session = Depends(get_session)
):
    # 1. Find the source meal and its entries
    source_meal = session.get(Meal, source_meal_id)
    if not source_meal:
        raise HTTPException(status_code=404, detail="Source meal not found")

    source_entries = session.exec(
        select(FoodEntry).where(FoodEntry.meal_id == source_meal_id)
    ).all()

    if not source_entries:
        return {"message": "Source meal has no entries to copy.", "added_count": 0}

    # 2. Get (or create) the destination meal
    dest_meal = get_or_create_meal(session, payload.date, payload.meal_name)

    # 3. Create new entries in the destination meal
    # Ensure all foods are cached locally before adding entries
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

# --- NEW: Pydantic model for a single day's summary ---
class HistoryDay(BaseModel):
    date: str
    kcal: float
    protein: float
    fat: float
    carb: float

# --- NEW: Endpoint to get summarized data for a date range ---
@app.get("/api/history", response_model=List[HistoryDay])
def get_history(
    start_date: date,
    end_date: date,
    session: Session = Depends(get_session)
):
    # This subquery calculates the macros for each food entry
    entry_macros = select(
        FoodEntry.meal_id.label("meal_id"),
        (Food.kcal_per_100g * FoodEntry.quantity_g / 100.0).label("kcal"),
        (Food.protein_g_per_100g * FoodEntry.quantity_g / 100.0).label("protein"),
        (Food.fat_g_per_100g * FoodEntry.quantity_g / 100.0).label("fat"),
        (Food.carb_g_per_100g * FoodEntry.quantity_g / 100.0).label("carb")
    ).join(Food, Food.fdc_id == FoodEntry.fdc_id).subquery()

    # This main query joins meals with the pre-calculated entry macros,
    # groups by date, and sums up the totals for each day.
    query = select(
        Meal.date,
        func.sum(entry_macros.c.kcal).label("kcal"),
        func.sum(entry_macros.c.protein).label("protein"),
        func.sum(entry_macros.c.fat).label("fat"),
        func.sum(entry_macros.c.carb).label("carb")
    ).join(entry_macros, Meal.id == entry_macros.c.meal_id)\
     .where(Meal.date >= start_date, Meal.date <= end_date)\
     .group_by(Meal.date)\
     .order_by(Meal.date)

    results = session.exec(query).all()
    
    # Fill in any missing days with zero values for a continuous chart
    history_map = {res.date: res for res in results}
    output = []
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.isoformat()
        if date_str in history_map:
            day_data = history_map[date_str]
            output.append(HistoryDay(date=date_str, kcal=day_data.kcal, protein=day_data.protein, fat=day_data.fat, carb=day_data.carb))
        else:
            output.append(HistoryDay(date=date_str, kcal=0, protein=0, fat=0, carb=0))
        current_date += timedelta(days=1)
        
    return output