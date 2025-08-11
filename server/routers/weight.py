from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

try:
    from ..db import get_session
    from ..models import BodyWeight
except ImportError:  # pragma: no cover
    from db import get_session
    from models import BodyWeight

router = APIRouter()


@router.get("/api/weight/{date}", response_model=BodyWeight)
def get_weight(date: str, session: Session = Depends(get_session)):
    weight = session.get(BodyWeight, date)
    if not weight:
        raise HTTPException(status_code=404, detail="Weight not found")
    return weight


class WeightPayload(BaseModel):
    weight: float


@router.put("/api/weight/{date}", response_model=BodyWeight)
def set_weight(date: str, payload: WeightPayload, session: Session = Depends(get_session)):
    weight_entry = session.get(BodyWeight, date)
    if weight_entry:
        weight_entry.weight = payload.weight
    else:
        weight_entry = BodyWeight(date=date, weight=payload.weight)
    session.add(weight_entry)
    session.commit()
    session.refresh(weight_entry)
    return weight_entry
