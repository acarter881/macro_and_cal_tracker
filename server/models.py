from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Boolean, UniqueConstraint

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
    __table_args__ = (UniqueConstraint("date", "sort_order", name="uq_meal_date_sort_order"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str
    name: str
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

class BodyWeight(SQLModel, table=True):
    date: str = Field(primary_key=True)
    weight: float
