import os

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from server import utils

router = APIRouter()


def require_config_token(token: str = Header(..., alias="X-Config-Token")) -> None:
    expected = os.environ.get("CONFIG_AUTH_TOKEN")
    if not expected or token != expected:
        raise HTTPException(status_code=401, detail="Invalid config token")

@router.get("/api/config/usda-key")
def get_usda_key(_: None = Depends(require_config_token)):
    return {"key": utils.USDA_KEY}

class KeyPayload(BaseModel):
    key: str

@router.post("/api/config/usda-key")
def set_usda_key(payload: KeyPayload, _: None = Depends(require_config_token)):
    if not payload.key:
        raise HTTPException(status_code=400, detail="Key required")
    utils.update_usda_key(payload.key)
    return {"ok": True}
