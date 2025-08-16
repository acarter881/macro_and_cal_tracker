from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from server.db import get_session
from server.models import BodyWeight

router = APIRouter()


@router.get("/api/weight/{date}", response_model=BodyWeight)
def get_weight(date: date, session: Session = Depends(get_session)):
    date_str = date.isoformat()
    weight = session.get(BodyWeight, date_str)
    if not weight:
        raise HTTPException(status_code=404, detail="Weight not found")
    return weight


class WeightPayload(BaseModel):
    weight: float


@router.put("/api/weight/{date}", response_model=BodyWeight)
def set_weight(date: date, payload: WeightPayload, session: Session = Depends(get_session)):
    date_str = date.isoformat()
    weight_entry = session.get(BodyWeight, date_str)
    if weight_entry:
        weight_entry.weight = payload.weight
    else:
        weight_entry = BodyWeight(date=date_str, weight=payload.weight)
    session.add(weight_entry)
    session.commit()
    session.refresh(weight_entry)
    return weight_entry
