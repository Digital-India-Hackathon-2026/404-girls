import os
import pandas as pd
import requests
from .usda_client import USDAClient, normalize_usda_data


DATASET_PATH = os.path.abspath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "..",
    "dataset",
    "combine_enriched.csv"
))


def load_local_dataset():
    if not os.path.exists(DATASET_PATH):
        return []
    try:
        df = pd.read_csv(DATASET_PATH)
        return df.to_dict("records")
    except Exception as exc:
        print(f"Could not load local dataset: {exc}")
        return []


LOCAL_DATASET = load_local_dataset()


FALLBACK_PRODUCTS = {
    "8901030895489": {
        "name": "Maggi Masala Noodles",
        "brand": "Nestle",
        "ingredients_text": "wheat flour, refined palm oil, salt, spices, flavour enhancer (msg), onion powder",
        "image_url": "",
        "nutriments": {
            "energy_100g": 470,
            "fat_100g": 18,
            "saturated-fat_100g": 8,
            "sugars_100g": 2,
            "salt_100g": 1.8,
            "proteins_100g": 8,
            "fiber_100g": 2
        },
        "categories": "Instant noodles, snack",
        "nova_group": "4",
        "nutriscore_grade": "d",
        "source": "Local fallback"
    },
    "8901063076665": {
        "name": "Parle-G Biscuit",
        "brand": "Parle",
        "ingredients_text": "wheat flour, sugar, edible vegetable oil, salt, leavening agents",
        "image_url": "",
        "nutriments": {
            "energy_100g": 440,
            "fat_100g": 15,
            "saturated-fat_100g": 5,
            "sugars_100g": 20,
            "salt_100g": 0.9,
            "proteins_100g": 6,
            "fiber_100g": 2
        },
        "categories": "Biscuits, snack",
        "nova_group": "4",
        "nutriscore_grade": "c",
        "source": "Local fallback"
    }
}


def lookup_product(barcode):
    """
    Fetches product data from OpenFoodFacts.
    Returns a dictionary of product data or None if not found.
    """
    if barcode in FALLBACK_PRODUCTS:
        return FALLBACK_PRODUCTS[barcode]

    try:
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        result = response.json()

        if result.get('status') == 1 and result.get('product'):
            product = result['product']
            return {
                'name': product.get('product_name', 'Unknown Product'),
                'brand': product.get('brands', 'Unknown Brand'),
                'ingredients_text': product.get('ingredients_text', ''),
                'image_url': product.get('image_url', ''),
                'nutriments': product.get('nutriments', {}),
                'categories': product.get('categories', ''),
                'nova_group': product.get('nova_group', None),
                'nutriscore_grade': product.get('nutriscore_grade', None),
                'source': 'OpenFoodFacts'
            }

        print(f"Product not found in OpenFoodFacts: {barcode}. Result: {result}")

    except Exception as e:
        print(f"Error looking up product in OpenFoodFacts: {e}")

    for row in LOCAL_DATASET:
        if str(row.get("id") or "").strip() == str(barcode).strip():
            return {
                "name": row.get("product_name") or "Unknown Product",
                "brand": row.get("brand") or "Unknown Brand",
                "ingredients_text": row.get("india_ingredient_1") or row.get("ingredient_explanation") or "",
                "image_url": "",
                "nutriments": {},
                "categories": row.get("category") or "",
                "nova_group": None,
                "nutriscore_grade": None,
                "source": "Local dataset"
            }

    try:
        usda = USDAClient()
        print(f"Searching USDA for barcode: {barcode}")
        results = usda.search_foods(barcode)

        if results:
            item = results[0]
            fdc_id = item.get("fdcId")
            if fdc_id:
                details = usda.get_food_details(fdc_id)
                return normalize_usda_data(details)

    except Exception as e:
        print(f"Error looking up product in USDA: {e}")

    return None
