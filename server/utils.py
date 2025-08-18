import json
import logging
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, Optional, TypedDict

import httpx
from fastapi import HTTPException
from sqlalchemy import func
from sqlmodel import Session, select
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from server.models import Food, Meal

USDA_BASE = "https://api.nal.usda.gov/fdc/v1"
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

CACHE_TTL = timedelta(days=30)

logger = logging.getLogger(__name__)

exceptions_to_retry = (
    httpx.ReadTimeout,
    httpx.ConnectTimeout,
    httpx.ReadError,
    httpx.RemoteProtocolError,
    httpx.ConnectError,
    httpx.NetworkError,
)

# Location for storing USDA API key between runs
CONFIG_PATH = Path(
    os.getenv("USDA_CONFIG_PATH") or Path.home() / ".macro_tracker_config.json"
)


def _load_config() -> Optional[Dict]:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except OSError as exc:
        logger.warning("Failed to load config %s: %s", CONFIG_PATH, exc)
        return None
    except json.JSONDecodeError as exc:
        logger.warning("Invalid JSON in config %s: %s", CONFIG_PATH, exc)
        raise


def _save_config(cfg: Dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f)


_config = _load_config() or {}

# USDA_KEY is loaded from config file first, then environment
USDA_KEY = _config.get("usda_key") or os.getenv("USDA_KEY")

_usda_client: Optional[httpx.AsyncClient] = None


async def get_usda_client() -> httpx.AsyncClient:
    """Return a shared AsyncClient for USDA requests."""
    global _usda_client
    if _usda_client is None:
        _usda_client = httpx.AsyncClient(
            timeout=20.0, headers={"Accept": "application/json"}
        )
    return _usda_client


async def aclose_usda_client() -> None:
    """Close the shared USDA AsyncClient if it exists."""
    global _usda_client
    if _usda_client is not None:
        await _usda_client.aclose()
        _usda_client = None


def update_usda_key(new_key: str) -> None:
    """Persist a new USDA API key and update global reference."""
    global USDA_KEY, _config
    USDA_KEY = new_key
    _config["usda_key"] = new_key
    _save_config(_config)


def _to_float(x):
    try:
        return float(x)
    except (ValueError, TypeError):
        return 0.0
    except Exception:
        logger.exception("Unexpected error converting %r to float", x)
        raise


class MacroTotals(TypedDict):
    kcal: float
    protein: float
    carb: float
    fat: float


def _parse_label_nutrients(
    lbl: dict, out: MacroTotals
) -> tuple[Optional[float], Optional[float]]:
    def lv(k):
        v = lbl.get(k) or {}
        return v.get("value")

    fiber_total = sugars = None
    if (v := lv("calories")) is not None:
        out["kcal"] = _to_float(v)
    if (v := lv("protein")) is not None:
        out["protein"] = _to_float(v)
    if (v := lv("fat")) is not None:
        out["fat"] = _to_float(v)
    if (v := lv("carbohydrates")) is not None:
        out["carb"] = _to_float(v)
    if (v := lv("fiber")) is not None:
        fiber_total = _to_float(v)
    if (v := lv("sugars")) is not None:
        sugars = _to_float(v)
    return fiber_total, sugars


def _resolve_fiber(
    fiber_total: Optional[float],
    fiber_sol: Optional[float],
    fiber_ins: Optional[float],
    fiber_any: Optional[float],
) -> Optional[float]:
    if fiber_total is not None:
        return fiber_total
    if fiber_sol is not None or fiber_ins is not None:
        return (fiber_sol or 0.0) + (fiber_ins or 0.0)
    if fiber_any is not None:
        return fiber_any
    return None


def _compute_calories(out: MacroTotals, fiber: Optional[float]) -> None:
    c_total = out["carb"] or 0.0
    f_total = fiber or 0.0
    digestible = max(0.0, c_total - f_total)
    out["kcal"] = round(
        out["protein"] * 4 + digestible * 4 + f_total * 2 + out["fat"] * 9, 2
    )


def extract_macros_from_fdc(data: dict) -> MacroTotals:
    out: MacroTotals = {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}
    sugars = starch = fiber_total = fiber_sol = fiber_ins = fiber_any = None
    water = ash = alcohol = None
    lbl = (data or {}).get("labelNutrients") or None
    if lbl:
        fiber_total, sugars = _parse_label_nutrients(lbl, out)
    for n in data.get("foodNutrients") or []:
        amt = n.get("amount")
        if amt is None:
            continue
        nut = n.get("nutrient") or {}
        name = (nut.get("name") or n.get("name") or "").strip().lower()
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
        if num == 1003 or "protein" in name:
            out["protein"] = a
        elif num in (1004, 1293) or "fat" in name and "trans" not in name:
            out["fat"] = a
        elif num == 1005 or "carbohydrate" in name:
            out["carb"] = a
        elif num == 1008 or "energy" in name:
            out["kcal"] = a
        elif num == 2000 or "sugar" in name:
            sugars = a
        elif num == 2001 or "starch" in name:
            starch = a
        elif num in (1079, 1082, 1056, 1057) or "fiber" in name:
            if "total" in name:
                fiber_total = a
            elif "soluble" in name:
                fiber_sol = a
            elif "insoluble" in name:
                fiber_ins = a
            else:
                fiber_any = a
        elif num == 1051 or "water" in name:
            water = a
        elif num == 1001 or "ash" in name:
            ash = a
        elif num == 1005 or "alcohol" in name:
            alcohol = a
    fiber = _resolve_fiber(fiber_total, fiber_sol, fiber_ins, fiber_any)
    if (out["carb"] or 0.0) == 0.0:
        comp_sum = sum(x for x in (sugars, starch, fiber) if x is not None)
        if comp_sum:
            out["carb"] = comp_sum
    if (out["carb"] or 0.0) == 0.0 and (water is not None and ash is not None):
        out["carb"] = max(
            0.0,
            100.0
            - (water or 0.0)
            - (out["protein"] or 0.0)
            - (out["fat"] or 0.0)
            - (ash or 0.0)
            - (alcohol or 0.0),
        )
    if (out["kcal"] or 0.0) == 0.0:
        _compute_calories(out, fiber)
    for k in out:
        out[k] = _to_float(out[k])
    return out


def _log_final_failure(retry_state):
    exc = retry_state.outcome.exception()
    logger.error(
        "USDA network error after %s attempts: %s",
        retry_state.attempt_number,
        exc,
    )
    raise HTTPException(status_code=502, detail=f"USDA network error: {exc!s}")


@retry(
    retry=retry_if_exception_type(exceptions_to_retry),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.4),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    retry_error_callback=_log_final_failure,
)
async def fetch_food_detail(fdc_id: int) -> dict:
    if not USDA_KEY:
        logger.error("USDA_KEY is not set on the server")
        raise HTTPException(status_code=500, detail="USDA_KEY is not set on the server")
    url = f"{USDA_BASE}/food/{fdc_id}"
    params = {"api_key": USDA_KEY}
    client = await get_usda_client()
    r = await client.get(url, params=params)
    try:
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        text = exc.response.text[:400]
        logger.error("USDA error %s: %s", status, text)
        raise HTTPException(status_code=status, detail=f"USDA error {status}: {text}")
    except json.JSONDecodeError as exc:
        logger.error("USDA JSON decode error: %s", exc)
        raise HTTPException(status_code=502, detail=f"USDA JSON decode error: {exc!s}")


async def ensure_food_cached(fdc_id: int, session: Session) -> Food:
    food = session.get(Food, fdc_id)
    now = datetime.utcnow()
    if food and food.fetched_at and food.fetched_at > now - CACHE_TTL:
        return food
    food_json = await fetch_food_detail(fdc_id)
    macros = extract_macros_from_fdc(food_json)
    if food is None:
        food = Food(fdc_id=fdc_id)
    food.description = food_json.get("description", f"FDC {fdc_id}")
    food.brand_owner = food_json.get("brandOwner")
    food.data_type = food_json.get("dataType")
    food.kcal_per_100g = macros["kcal"]
    food.protein_g_per_100g = macros["protein"]
    food.fat_g_per_100g = macros["fat"]
    food.carb_g_per_100g = macros["carb"]
    food.fetched_at = now
    session.add(food)
    session.commit()
    session.refresh(food)
    return food


def scaled_macros_from_food(f: Food, qty: float) -> tuple[float, float, float, float]:
    """Return kcal, protein, carb and fat scaled by quantity for a food item."""
    if f.unit_name:
        factor = qty or 0
        return (
            (f.kcal_per_unit or 0) * factor,
            (f.protein_g_per_unit or 0) * factor,
            (f.carb_g_per_unit or 0) * factor,
            (f.fat_g_per_unit or 0) * factor,
        )
    factor = (qty or 0) / 100.0
    return (
        (f.kcal_per_100g or 0) * factor,
        (f.protein_g_per_100g or 0) * factor,
        (f.carb_g_per_100g or 0) * factor,
        (f.fat_g_per_100g or 0) * factor,
    )


def get_or_create_meal(session: Session, date: date, name: str) -> Meal:
    date_str = date.isoformat()
    m = session.exec(
        select(Meal).where(Meal.date == date_str, Meal.name == name)
    ).first()
    if m:
        return m
    max_sort_order = (
        session.exec(
            select(func.max(Meal.sort_order)).where(Meal.date == date_str)
        ).first()
        or 0
    )
    new_order = max_sort_order + 1
    m = Meal(date=date_str, name=name, sort_order=new_order)
    session.add(m)
    session.commit()
    session.refresh(m)
    return m
