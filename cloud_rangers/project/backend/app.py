# ============================================================
# Label Padegha Sabh — FastAPI Backend v2
# Merged: Auth/Database (HEAD) + Product Intelligence (incoming)
# ============================================================

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import sys
import base64
import json
import re
import logging

# ── sys.path setup ──────────────────────────────────────────
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# ── Logging ─────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ── Optional: Database / Auth ────────────────────────────────
try:
    from database import (
        register_user, login_user, get_user_by_id,
        get_health_profile, update_health_profile,
        save_scan, get_scan_history, get_all_allergens,
        create_order, get_user_orders
    )
    DB_AVAILABLE = True
    print("[OK] Database module loaded")
except ImportError as e:
    print(f"! Database module not available: {e}")
    DB_AVAILABLE = False

# ── Product Intelligence utils ───────────────────────────────
try:
    from utils.product_lookup import lookup_product
    from utils.data_processor import normalize_product_data, parse_ingredients
    from utils.risk_engine import load_banned_ingredients, check_banned_ingredients, calculate_health_score
    from utils.gemini_integration import GeminiHandler
    from news_service import get_safety_news
    from utils.analysis_engine import analyze_product as run_product_analysis

    try:
        gemini = GeminiHandler()
    except Exception as e:
        print(f"Warning: Gemini not initialized: {e}")
        gemini = None

    BANNED_DB_PATH = os.path.join(_backend_dir, "data", "banned_ingredients.csv")
    banned_df = load_banned_ingredients(BANNED_DB_PATH) if os.path.exists(BANNED_DB_PATH) else None

    UTILS_AVAILABLE = True
    print("[OK] Product analysis utils loaded")
except ImportError as e:
    print(f"! Product analysis utils not available: {e}")
    gemini = None
    banned_df = None
    lookup_product = None
    UTILS_AVAILABLE = False

# ── FastAPI app ──────────────────────────────────────────────
app = FastAPI(title="Label Padegha Sabh API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic Models ──────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class HealthProfileUpdate(BaseModel):
    allergies: Optional[List[str]] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    age: Optional[int] = None
    dietary_preference: Optional[str] = None
    other_allergy: Optional[str] = None
    other_diet: Optional[str] = None
    sensitivities: Optional[str] = None

class AnalysisRequest(BaseModel):
    product_name: Optional[str] = None
    ingredients: Optional[List[str]] = None
    risks: Optional[List[dict]] = None
    image: Optional[str] = None
    preferences: Optional[dict] = None

class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None

class AnalyzeProductRequest(BaseModel):
    barcode: str
    age: Optional[int] = None
    allergies: Optional[List[str]] = None
    conditions: Optional[List[str]] = None
    diet: Optional[str] = None

class ProductRequest(BaseModel):
    query: Optional[str] = None

class CartItem(BaseModel):
    barcode: str
    product_name: str
    brand: str
    quantity: int
    price: float

class CheckoutRequest(BaseModel):
    items: List[CartItem]

# ── Auth helper ──────────────────────────────────────────────

def get_current_user(user_id: Optional[str] = Header(None, alias="X-User-Id")):
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    user = get_user_by_id(int(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ═══════════════════════════════════════════════════════════
# CORE ROUTES
# ═══════════════════════════════════════════════════════════

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "db_available": DB_AVAILABLE,
        "utils_available": UTILS_AVAILABLE
    }

# ── Auth Routes ──────────────────────────────────────────────

@app.post("/api/auth/register")
async def api_register(request: RegisterRequest):
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    if not request.full_name or not request.email or not request.password:
        raise HTTPException(status_code=400, detail="Missing required fields")
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user = register_user(request.full_name, request.email, request.password)
    if not user:
        raise HTTPException(status_code=409, detail="Email already registered")
    return {"success": True, "user": user}

@app.post("/api/auth/login")
async def api_login(request: LoginRequest):
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    if not request.email or not request.password:
        raise HTTPException(status_code=400, detail="Missing email or password")
    user = login_user(request.email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"success": True, "user": user}

@app.get("/api/auth/me")
async def api_me(current_user: dict = Depends(get_current_user)):
    return {"success": True, "user": current_user}

# ── Health Profile Routes ────────────────────────────────────

@app.get("/api/profile")
async def api_get_profile(current_user: dict = Depends(get_current_user)):
    profile = get_health_profile(current_user["id"])
    return {"success": True, "profile": profile or {}}

@app.put("/api/profile")
async def api_update_profile(data: HealthProfileUpdate, current_user: dict = Depends(get_current_user)):
    profile_data = data.dict(exclude_none=True)
    if not update_health_profile(current_user["id"], profile_data):
        raise HTTPException(status_code=500, detail="Failed to update profile")
    return {"success": True, "profile": get_health_profile(current_user["id"])}

# ── Scan History Routes ──────────────────────────────────────

@app.post("/api/scan/save")
async def api_save_scan(scan_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    scan_id = save_scan(current_user["id"], scan_data)
    return {"success": True, "scan_id": scan_id}

@app.get("/api/scan/history")
async def api_scan_history(limit: int = 20, current_user: dict = Depends(get_current_user)):
    scans = get_scan_history(current_user["id"], limit)
    return {"success": True, "scans": scans}

@app.get("/api/allergens")
async def api_allergens():
    allergens = get_all_allergens() if DB_AVAILABLE else []
    return {"success": True, "allergens": allergens}

# ═══════════════════════════════════════════════════════════
# PRODUCT INTELLIGENCE ROUTES
# ═══════════════════════════════════════════════════════════

@app.post("/api/analyze-product")
def analyze_product_endpoint(request: AnalyzeProductRequest):
    """
    Unified Product Intelligence Pipeline.
    Input:  barcode + optional user profile
    Output: complete analysis (concern score, ingredients, allergens,
            regulatory, warnings, news, AI summary)

    NOTE (Bug #7 fix): Returns HTTP 200 even when a product is not found,
    with {"error": "..."} in the body. The frontend JS checks `data.error`
    — this only works on a 200 response. A 404/HTTPException was previously
    silently swallowing the error message.
    """
    if not UTILS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Product analysis utils not available")

    logger.info(f"=== /api/analyze-product barcode={request.barcode} ===")

    user_profile = {
        "age":        request.age,
        "allergies":  request.allergies  or [],
        "conditions": request.conditions or [],
        "diet":       request.diet       or ""
    }

    result = run_product_analysis(request.barcode, user_profile)

    if result.get("error"):
        logger.warning(f"Product not found: {result['error']}")
        # Return 200 + error field so the frontend data.error check works
        return {"error": result["error"]}

    logger.info(f"Analysis complete. Score={result.get('concern_score', {}).get('score', 'N/A')}")
    return result


@app.get("/api/news")
def news_endpoint(product_name: str, max_articles: int = 10):
    if not UTILS_AVAILABLE:
        raise HTTPException(status_code=503, detail="News service not available")
    try:
        return get_safety_news(product_name, max_articles)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    from config import get_api_key
    api_key = get_api_key("gemini")
    is_placeholder = not api_key or "your_gemini_api_key_here" in api_key or len(api_key) < 20

    if not gemini or is_placeholder:
        # Return a specific error code so frontend knows AI is not available
        raise HTTPException(status_code=503, detail="AI service not configured")
    try:
        if request.context:
            gemini.start_chat(request.context)
        response = gemini.send_message(request.message)
        if not response or response.startswith("AI "):
            # Gemini returned an error message
            raise HTTPException(status_code=500, detail=response)
        return {"response": response}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

@app.api_route("/api/product/{barcode}", methods=["GET", "POST"])
def get_product(barcode: str):
    """Fetch product by barcode with risk enrichment."""
    if not UTILS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Product utils not available")

    raw_data = lookup_product(barcode)
    if not raw_data:
        raise HTTPException(status_code=404, detail="Product not found")

    product = normalize_product_data(raw_data)
    ingredients_list = parse_ingredients(product.get('ingredients_text', ''))
    risks = check_banned_ingredients(ingredients_list, banned_df) if banned_df is not None else []
    product['parsed_ingredients'] = ingredients_list
    product['risks'] = risks
    product['health_score'] = calculate_health_score(product.get('nutriments', {}))
    return product

@app.post("/api/analyze")
def analyze_legacy(request: AnalysisRequest):
    """Legacy OCR / image analysis endpoint."""
    if not UTILS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Analysis utils not available")

    from config import get_api_key
    api_key = get_api_key("gemini")
    is_placeholder = not api_key or "your_gemini_api_key_here" in api_key

    mock_payload = {
        "name": "Coca-Cola (OCR Demo)", "brand": "The Coca-Cola Company",
        "ingredients_text": "carbonated water, sugar, colour (caramel e150d), phosphoric acid, natural flavourings including caffeine",
        "image_url": "",
        "nutriments": {"energy_100g": 180, "sugars_100g": 10.6, "saturated-fat_100g": 0.0,
                       "salt_100g": 0.0, "proteins_100g": 0.0, "fiber_100g": 0.0},
        "categories": "beverages", "nova_group": 4, "nutriscore_grade": "e", "source": "Gemini OCR Mock"
    }

    def _enrich(payload):
        p = normalize_product_data(payload)
        ings = parse_ingredients(p['ingredients_text'])
        risks = check_banned_ingredients(ings, banned_df) if banned_df is not None else []
        p['parsed_ingredients'] = ings
        p['risks'] = risks
        p['health_score'] = calculate_health_score(p.get('nutriments', {}))
        try:
            from utils.excel_parser import get_additives_report
            p['additive_regulatory_report'] = get_additives_report(ings)
        except Exception as e:
            p['additive_regulatory_report'] = []
        return p

    if request.image:
        if not gemini or is_placeholder:
            return _enrich(mock_payload)
        try:
            header, b64 = request.image.split(",", 1) if "," in request.image else ("", request.image)
            image_bytes = base64.b64decode(b64)
            mime = "image/jpeg"
            if "image/png" in header: mime = "image/png"
            elif "image/webp" in header: mime = "image/webp"
            ocr_text = gemini.analyze_label_image(image_bytes, mime)
            cleaned = re.sub(r"^```(?:json)?\n", "", ocr_text.strip())
            cleaned = re.sub(r"\n```$", "", cleaned).strip()
            return _enrich(json.loads(cleaned))
        except Exception as e:
            print(f"OCR failed ({e}), returning mock")
            return _enrich(mock_payload)

    if not gemini or is_placeholder:
        return {"explanation": "AI Service Unavailable. Configure GEMINI_API_KEY."}
    try:
        explanation = gemini.explain_risks(
            request.product_name or "Unknown",
            request.ingredients or [],
            request.risks or []
        )
        return {"explanation": explanation}
    except Exception as e:
        return {"explanation": f"AI error: {str(e)}"}


# ═══════════════════════════════════════════════════════════
# MART / CHECKOUT API ENDPOINTS
# ═══════════════════════════════════════════════════════════

MOCK_BARCODES = {
    "Cerelac Wheat Based Cereal (6+ months)": "8901030922895",
    "Maggi 2-Minute Masala Noodles": "8901058851311",
    "Cadbury Dairy Milk (Classic Bar)": "7622201149406",
    "Red Bull Energy Drink": "9002470026260",
    "Lay's Classic Salted Potato Chips": "8901491101831",
    "Coca-Cola (Original)": "5449000000996",
    "Oreo Original Sandwich Biscuit": "7622300744618",
    "Kellogg's Corn Flakes": "8901058861617",
    "Heinz Tomato Ketchup": "8901137000016",
    "McDonald's French Fries": "9990000000010",
    "Skittles Original": "4009900481223",
    "Pringles Original": "8886467122392",
    "KitKat (4-Finger Milk Chocolate)": "7622210449283",
    "Domino's Pizza (Cheese Topping)": "9990000000014",
    "M&M's Milk Chocolate": "040000004314",
    "Knorr Bouillon / All Purpose Seasoning": "8901137000023",
    "Cadbury Bournville (Dark Chocolate)": "7622201725839",
    "Doritos Nacho Cheese": "8901491503055",
    "Kinder Joy": "8000500223788"
}

MOCK_PRICES = {
    "Cerelac Wheat Based Cereal (6+ months)": 280.00,
    "Maggi 2-Minute Masala Noodles": 14.00,
    "Cadbury Dairy Milk (Classic Bar)": 45.00,
    "Red Bull Energy Drink": 125.00,
    "Lay's Classic Salted Potato Chips": 20.00,
    "Coca-Cola (Original)": 40.00,
    "Oreo Original Sandwich Biscuit": 35.00,
    "Kellogg's Corn Flakes": 185.00,
    "Heinz Tomato Ketchup": 150.00,
    "McDonald's French Fries": 95.00,
    "Skittles Original": 50.00,
    "Pringles Original": 110.00,
    "KitKat (4-Finger Milk Chocolate)": 25.00,
    "Domino's Pizza (Cheese Topping)": 299.00,
    "M&M's Milk Chocolate": 85.00,
    "Knorr Bouillon / All Purpose Seasoning": 65.00,
    "Cadbury Bournville (Dark Chocolate)": 100.00,
    "Doritos Nacho Cheese": 50.00,
    "Kinder Joy": 45.00
}


def check_product_warnings(name, brand, ingredients_text, allergens, profile):
    warnings = []
    if not profile:
        return warnings
        
    user_allergies = profile.get("allergies", [])
    diet = profile.get("dietary_preference", "")
    age = profile.get("age")
    
    ingredients_lower = ingredients_text.lower()
    
    # 1. Allergen checks
    # Milk/Dairy allergy
    if "dairy" in user_allergies or "milk" in user_allergies:
        dairy_triggers = ["milk", "dairy", "cheese", "cream", "butter", "yogurt", "lactose", "casein", "whey"]
        matched_triggers = [t for t in dairy_triggers if t in ingredients_lower or any(t in a.lower() for a in allergens)]
        if matched_triggers:
            warnings.append({
                "type": "allergy",
                "severity": "danger",
                "message": f"Contains dairy elements ({', '.join(matched_triggers)}). Conflicts with Milk/Dairy allergy."
            })
            
    # Nuts allergy
    if "nuts" in user_allergies or "peanuts" in user_allergies:
        nut_triggers = ["peanut", "cashew", "walnut", "almond", "hazelnut", "pistachio", "tree nut", "groundnut", "nut"]
        matched_triggers = [t for t in nut_triggers if t in ingredients_lower or any(t in a.lower() for a in allergens)]
        if matched_triggers:
            warnings.append({
                "type": "allergy",
                "severity": "danger",
                "message": f"Contains nut/groundnut elements ({', '.join(matched_triggers)}). Conflicts with Nuts allergy."
            })

    # Gluten/Wheat allergy
    if "gluten" in user_allergies or "wheat" in user_allergies:
        gluten_triggers = ["wheat", "gluten", "barley", "rye", "flour", "maida", "semolina"]
        matched_triggers = [t for t in gluten_triggers if t in ingredients_lower or any(t in a.lower() for a in allergens)]
        if matched_triggers:
            warnings.append({
                "type": "allergy",
                "severity": "danger",
                "message": f"Contains wheat/gluten ({', '.join(matched_triggers)}). Conflicts with Gluten/Wheat allergy."
            })
            
    # Soy allergy
    if "soy" in user_allergies or "soya" in user_allergies:
        soy_triggers = ["soy", "soya", "tofu", "lecithin"]
        matched_triggers = [t for t in soy_triggers if t in ingredients_lower or any(t in a.lower() for a in allergens)]
        if matched_triggers:
            warnings.append({
                "type": "allergy",
                "severity": "danger",
                "message": f"Contains soy/lecithin ({', '.join(matched_triggers)}). Conflicts with Soy allergy."
            })
            
    # Egg allergy
    if "eggs" in user_allergies or "egg" in user_allergies:
        egg_triggers = ["egg", "albumen", "yolk", "mayonnaise"]
        matched_triggers = [t for t in egg_triggers if t in ingredients_lower or any(t in a.lower() for a in allergens)]
        if matched_triggers:
            warnings.append({
                "type": "allergy",
                "severity": "danger",
                "message": f"Contains egg elements ({', '.join(matched_triggers)}). Conflicts with Egg allergy."
            })

    # 2. Dietary preference checks
    # Vegetarian check
    if diet == "vegetarian":
        non_veg_triggers = ["chicken", "fish", "beef", "pork", "meat", "gelatin", "lard", "mutton", "egg", "shrimp", "prawn", "crab", "lobster"]
        matched_triggers = [t for t in non_veg_triggers if t in ingredients_lower]
        if matched_triggers:
            warnings.append({
                "type": "diet",
                "severity": "danger",
                "message": f"Contains non-vegetarian ingredients ({', '.join(matched_triggers)}). Conflicts with Vegetarian preference."
            })
            
    # Vegan check
    if diet == "vegan":
        animal_triggers = ["milk", "dairy", "cheese", "cream", "butter", "yogurt", "lactose", "casein", "whey", "egg", "gelatin", "honey", "lard", "meat", "chicken", "fish", "beef", "pork"]
        matched_triggers = [t for t in animal_triggers if t in ingredients_lower or any(t in a.lower() for a in allergens)]
        if matched_triggers:
            warnings.append({
                "type": "diet",
                "severity": "danger",
                "message": f"Contains animal-derived ingredients ({', '.join(matched_triggers)}). Conflicts with Vegan preference."
            })
            
    # Diabetic-Friendly check
    if diet == "diabetic-friendly":
        sugar_triggers = ["sugar", "sucrose", "glucose", "fructose", "high fructose corn syrup", "corn syrup", "maltodextrin", "dextrose", "invert syrup"]
        matched_triggers = [t for t in sugar_triggers if t in ingredients_lower]
        if matched_triggers or "sugar" in name.lower():
            warnings.append({
                "type": "diet",
                "severity": "warning",
                "message": f"Contains high glycemic sugars/sweeteners ({', '.join(matched_triggers)}). Caution for Diabetic-Friendly profile."
            })
            
    # Keto check
    if diet == "keto":
        carb_triggers = ["wheat", "maida", "flour", "potato", "starch", "sugar", "rice", "corn", "maltodextrin", "sucrose", "glucose", "syrup"]
        matched_triggers = [t for t in carb_triggers if t in ingredients_lower]
        if matched_triggers:
            warnings.append({
                "type": "diet",
                "severity": "warning",
                "message": f"Contains high carb elements ({', '.join(matched_triggers)}). Conflicts with low-carb Keto profile."
            })

    # 3. Age checks
    if age is not None:
        if age < 18:
            if "caffeine" in ingredients_lower or "taurine" in ingredients_lower or "energy drink" in name.lower():
                warnings.append({
                    "type": "age",
                    "severity": "warning",
                    "message": "High caffeine/energy content. Not recommended for children/minors."
                })
            color_triggers = ["colour", "color", "e150d", "e102", "e110", "e129", "e122", "e124", "e133"]
            matched_colors = [t for t in color_triggers if t in ingredients_lower]
            if matched_colors:
                warnings.append({
                    "type": "age",
                    "severity": "warning",
                    "message": f"Contains artificial coloring agent ({', '.join(matched_colors)}). Minimize consumption for children."
                })
        if age <= 2:
            if ("sugar" in ingredients_lower or "sucrose" in ingredients_lower or "glucose" in ingredients_lower) and ("baby" in name.lower() or "cerelac" in name.lower()):
                warnings.append({
                    "type": "age",
                    "severity": "danger",
                    "message": "WHO recommends zero added sugar in foods for infants/young children under 2. This infant food contains added sugars."
                })
                
    return warnings


@app.get("/api/mart/products")
def get_mart_products():
    from utils.product_lookup import CSV_DF
    if CSV_DF.empty:
        return {"success": False, "products": []}
    
    products = []
    for _, row in CSV_DF.iterrows():
        name = str(row.get("product_name", "")).strip()
        brand = str(row.get("brand", "")).strip()
        if not name:
            continue
        
        # Resolve barcode
        barcode = str(row.get("barcode_india", "")).strip()
        if not barcode or barcode == "nan" or barcode.lower() == "none":
            barcode = MOCK_BARCODES.get(name, "")
        else:
            if barcode.endswith(".0"):
                barcode = barcode[:-2]
        
        price = MOCK_PRICES.get(name, 40.00)
        
        # Extract ingredients
        india_ings = []
        for i in range(1, 11):
            val = str(row.get(f"india_ingredient_{i}", "")).strip()
            if val:
                india_ings.append(val)
        ingredients_text = ", ".join(india_ings)
        
        allergens_raw = str(row.get("allergens", "")).strip()
        allergens = [a.strip() for a in allergens_raw.split(",") if a.strip()]

        additives_raw = str(row.get("notable_additives", "")).strip()
        additives = [a.strip() for a in additives_raw.split(",") if a.strip()]
        
        products.append({
            "id": str(row.get("id", "")),
            "name": name,
            "brand": brand,
            "barcode": barcode,
            "category": str(row.get("category", "")).strip(),
            "price": price,
            "ingredients_text": ingredients_text,
            "allergens": allergens,
            "additives": additives,
            "health_note": str(row.get("health_note", "")).strip(),
            "health_concern": str(row.get("health_concern", "")).strip(),
            "consumer_note": str(row.get("consumer_note", "")).strip()
        })
    return {"success": True, "products": products}


@app.post("/api/mart/checkout")
async def api_checkout(request: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    profile = get_health_profile(current_user["id"])
    
    all_warnings = []
    critical_count = 0
    items_to_save = []
    
    from utils.product_lookup import CSV_DF
    
    for item in request.items:
        items_to_save.append({
            "barcode": item.barcode,
            "product_name": item.product_name,
            "brand": item.brand,
            "quantity": item.quantity,
            "price": item.price
        })
        
        csv_row = None
        if not CSV_DF.empty:
            mask = (CSV_DF["barcode_india"].str.strip() == item.barcode)
            if mask.any():
                csv_row = CSV_DF[mask].iloc[0]
            else:
                mask_name = CSV_DF["product_name"].str.lower().str.strip() == item.product_name.lower().strip()
                if mask_name.any():
                    csv_row = CSV_DF[mask_name].iloc[0]
        
        ingredients_text = ""
        allergens = []
        if csv_row is not None:
            india_ings = []
            for i in range(1, 11):
                val = str(csv_row.get(f"india_ingredient_{i}", "")).strip()
                if val:
                    india_ings.append(val)
            ingredients_text = ", ".join(india_ings)
            
            allergens_raw = str(csv_row.get("allergens", "")).strip()
            allergens = [a.strip() for a in allergens_raw.split(",") if a.strip()]
        
        item_warnings = check_product_warnings(
            item.product_name,
            item.brand,
            ingredients_text,
            allergens,
            profile
        )
        
        for w in item_warnings:
            all_warnings.append({
                "product_name": item.product_name,
                "barcode": item.barcode,
                "type": w["type"],
                "severity": w["severity"],
                "message": w["message"]
            })
            if w["severity"] == "danger":
                critical_count += 1
                
    total_price = sum(item.price * item.quantity for item in request.items)
    items_count = sum(item.quantity for item in request.items)
    
    try:
        order_id = create_order(current_user["id"], total_price, items_count, items_to_save)
        return {
            "success": True,
            "order_id": order_id,
            "warnings": all_warnings,
            "critical_count": critical_count
        }
    except Exception as e:
        logger.error(f"Checkout failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to place order. Database error.")


@app.get("/api/mart/orders")
async def api_get_orders(current_user: dict = Depends(get_current_user)):
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        orders = get_user_orders(current_user["id"])
        return {"success": True, "orders": orders}
    except Exception as e:
        logger.error(f"Failed to fetch orders: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch orders history.")


# ═══════════════════════════════════════════════════════════
# STATIC FILE SERVING
# ═══════════════════════════════════════════════════════════

frontend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assets_path = os.path.join(frontend_path, "assets")

if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
async def read_index():
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Label Padegha Sabh API", "status": "running", "version": "2.0.0"}

@app.get("/{filename}.html")
def read_html(filename: str):
    file_path = os.path.join(frontend_path, f"{filename}.html")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/{filename}.js")
def read_js(filename: str):
    file_path = os.path.join(frontend_path, f"{filename}.js")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/{filename}.css")
def read_css(filename: str):
    file_path = os.path.join(frontend_path, f"{filename}.css")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 50)
    print("  Label Padegha Sabh API Server")
    print("  Visit: http://127.0.0.1:8000")
    print("=" * 50 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8000)
