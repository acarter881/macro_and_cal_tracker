from server.models import Food
from server.utils import scaled_macros_from_food


def test_scaled_macros_from_food_per100g():
    food = Food(
        fdc_id=1,
        description="Test Food",
        data_type="Test",
        kcal_per_100g=200,
        protein_g_per_100g=10,
        carb_g_per_100g=30,
        fat_g_per_100g=5,
    )
    macros = scaled_macros_from_food(food, 50)
    assert macros == (100.0, 5.0, 15.0, 2.5)


def test_scaled_macros_from_food_unit():
    food = Food(
        fdc_id=2,
        description="Unit Food",
        data_type="Test",
        kcal_per_100g=0,
        protein_g_per_100g=0,
        carb_g_per_100g=0,
        fat_g_per_100g=0,
        unit_name="piece",
        kcal_per_unit=40,
        protein_g_per_unit=2,
        carb_g_per_unit=4,
        fat_g_per_unit=1,
    )
    macros = scaled_macros_from_food(food, 3)
    assert macros == (120.0, 6.0, 12.0, 3.0)
