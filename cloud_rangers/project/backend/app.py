from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sys
import os

# Add current directory to path so we can import utils
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.product_lookup import lookup_product
from utils.data_processor import normalize_product_data, parse_ingredients
from utils.risk_engine import load_banned_ingredients, check_banned_ingredients, calculate_health_score
from utils.gemini_integration import GeminiHandler

app = FastAPI()

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini
try:
    gemini = GeminiHandler()
except Exception as e:
    print(f"Warning: Gemini not initialized: {e}")
    gemini = None

# Load Banned Ingredients
BANNED_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "banned_ingredients.csv")
banned_df = load_banned_ingredients(BANNED_DB_PATH)

class ProductRequest(BaseModel):
    query: str

class AnalysisRequest(BaseModel):
    product_name: str
    ingredients: List[str]
    risks: List[dict]

@app.api_route("/api/product/{barcode}", methods=["GET", "POST"])
async def get_product(barcode: str):
    print(f"Fetching product: {barcode}")
    raw_data = lookup_product(barcode)
    
    if not raw_data:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Normalize
    product = normalize_product_data(raw_data)
    
    # Parse Ingredients
    ingredients_list = parse_ingredients(product['ingredients_text'])
    
    # Risk Check
    risks = check_banned_ingredients(ingredients_list, banned_df)
    
    # Health Score
    score = calculate_health_score(product.get('nutriments', {}))
    
    # Enrich response
    product['parsed_ingredients'] = ingredients_list
    product['risks'] = risks
    product['health_score'] = score
    
    return product

@app.post("/api/analyze")
async def analyze_product(request: AnalysisRequest):
    if not gemini:
        raise HTTPException(status_code=503, detail="AI Service Unavailable")
        
    explanation = gemini.explain_risks(
        request.product_name,
        request.ingredients,
        request.risks
    )
    
    return {"explanation": explanation}

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Mount frontend from the project root so the scanner and product pages are served correctly
frontend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assets_path = os.path.join(frontend_path, "assets")
app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
async def read_index():
    return FileResponse(os.path.join(frontend_path, "index.html"))

# Serve other HTML files directly if needed (e.g. scanner.html)
@app.get("/{filename}.html")
async def read_html(filename: str):
    file_path = os.path.join(frontend_path, f"{filename}.html")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

# Also serve js/css if they are in root of frontend
@app.get("/{filename}.js")
async def read_js(filename: str):
    file_path = os.path.join(frontend_path, f"{filename}.js")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/{filename}.css")
async def read_css(filename: str):
    file_path = os.path.join(frontend_path, f"{filename}.css")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")
