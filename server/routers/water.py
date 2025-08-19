from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from server.db import get_session
from server.models import WaterIntake

router = APIRouter()


@router.get("/api/water/{date}", response_model=WaterIntake)
def get_water(date: date, session: Session = Depends(get_session)):
    date_str = date.isoformat()
    water = session.get(WaterIntake, date_str)
    if not water:
        raise HTTPException(status_code=404, detail="Water intake not found")
    return water


class WaterPayload(BaseModel):
    milliliters: float


@router.put("/api/water/{date}", response_model=WaterIntake)
def set_water(
    date: date, payload: WaterPayload, session: Session = Depends(get_session)
):
    date_str = date.isoformat()
    water_entry = session.get(WaterIntake, date_str)
    if water_entry:
        water_entry.milliliters = payload.milliliters
    else:
        water_entry = WaterIntake(date=date_str, milliliters=payload.milliliters)
    session.add(water_entry)
    session.commit()
    session.refresh(water_entry)
    return water_entry
