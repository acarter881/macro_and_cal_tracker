from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server import utils

router = APIRouter()

@router.get("/api/config/usda-key")
def get_usda_key():
    return {"key": utils.USDA_KEY}

class KeyPayload(BaseModel):
    key: str

@router.post("/api/config/usda-key")
def set_usda_key(payload: KeyPayload):
    if not payload.key:
        raise HTTPException(status_code=400, detail="Key required")
    utils.update_usda_key(payload.key)
    return {"ok": True}
