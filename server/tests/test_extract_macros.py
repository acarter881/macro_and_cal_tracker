from server.utils import extract_macros_from_fdc

from server.utils import extract_macros_from_fdc


def test_extract_macros_empty():
    assert extract_macros_from_fdc({}) == {"kcal": 0.0, "protein": 0.0, "carb": 0.0, "fat": 0.0}


def test_extract_macros_compute_from_components():
    data = {
        "foodNutrients": [
            {"nutrientNumber": 2000, "amount": 5},  # sugars
            {"nutrientNumber": 2001, "amount": 10},  # starch
            {"nutrientNumber": 1079, "name": "Fiber, total", "amount": 5},
            {"nutrientNumber": 1004, "amount": 1},  # fat
            {"nutrientNumber": 1003, "amount": 2},  # protein
        ]
    }
    macros = extract_macros_from_fdc(data)
    assert macros == {"kcal": 87.0, "protein": 2.0, "carb": 20.0, "fat": 1.0}


def test_extract_macros_odd_nutrient_numbers():
    data = {
        "foodNutrients": [
            {"nutrientNumber": "1003.0", "amount": "10"},
            {"nutrientId": "1004", "amount": 5},
            {"nutrient": {"number": "1005", "name": "Carbohydrate"}, "amount": 20},
            {"nutrientNumber": "9999", "amount": 1},
        ]
    }
    macros = extract_macros_from_fdc(data)
    assert macros["protein"] == 10
    assert macros["fat"] == 5
    assert macros["carb"] == 20
    assert macros["kcal"] == 165.0
