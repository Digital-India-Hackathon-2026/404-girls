"""
Database module for Label Padegha Sabh.
Handles user registration, authentication, and health profile storage.
Uses SQLite for simplicity.
"""

import sqlite3
import os
import json
import hashlib
import secrets
from datetime import datetime
from typing import Optional, Dict, List, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "lps.db")


def get_connection():
    """Get a database connection with row factory."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize the database schema."""
    conn = get_connection()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Health profiles table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS health_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            allergies TEXT DEFAULT '[]',
            height REAL,
            weight REAL,
            age INTEGER,
            dietary_preference TEXT,
            other_allergy TEXT,
            other_diet TEXT,
            sensitivities TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Scan history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scan_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_name TEXT,
            barcode TEXT,
            ingredients TEXT,
            health_score REAL,
            risks TEXT DEFAULT '[]',
            scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Allergens reference table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS allergens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            category TEXT,
            description TEXT,
            common_sources TEXT
        )
    """)

    # Orders table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total_price REAL NOT NULL,
            items_count INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Order items table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            barcode TEXT NOT NULL,
            product_name TEXT NOT NULL,
            brand TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
    """)

    # Seed default demo user if not exists
    cursor.execute("SELECT id FROM users WHERE id = 1")
    if not cursor.fetchone():
        # Register demo user with ID = 1
        password_hash, salt = hash_password("password")
        cursor.execute(
            "INSERT INTO users (id, full_name, email, password_hash, salt) VALUES (?, ?, ?, ?, ?)",
            (1, "Demo User", "demo@labelpadega.com", password_hash, salt)
        )
        cursor.execute(
            "INSERT INTO health_profiles (user_id) VALUES (?)",
            (1,)
        )

    conn.commit()
    conn.close()


def hash_password(password: str, salt: Optional[str] = None) -> tuple:
    """Hash a password with a salt."""
    if salt is None:
        salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return password_hash, salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    """Verify a password against its hash."""
    calculated_hash, _ = hash_password(password, salt)
    return calculated_hash == password_hash


# ── User Operations ──

def register_user(full_name: str, email: str, password: str) -> Optional[Dict]:
    """Register a new user. Returns user dict or None if email exists."""
    conn = get_connection()
    cursor = conn.cursor()

    # Check if email already exists
    cursor.execute("SELECT id FROM users WHERE email = ?", (email.lower(),))
    if cursor.fetchone():
        conn.close()
        return None

    password_hash, salt = hash_password(password)
    cursor.execute(
        "INSERT INTO users (full_name, email, password_hash, salt) VALUES (?, ?, ?, ?)",
        (full_name, email.lower(), password_hash, salt)
    )
    user_id = cursor.lastrowid

    # Create empty health profile
    cursor.execute(
        "INSERT INTO health_profiles (user_id) VALUES (?)",
        (user_id,)
    )

    conn.commit()
    conn.close()

    return {"id": user_id, "full_name": full_name, "email": email.lower()}


def login_user(email: str, password: str) -> Optional[Dict]:
    """Authenticate a user. Returns user dict or None."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, full_name, email, password_hash, salt FROM users WHERE email = ?",
        (email.lower(),)
    )
    user = cursor.fetchone()
    conn.close()

    if user and verify_password(password, user["password_hash"], user["salt"]):
        return {"id": user["id"], "full_name": user["full_name"], "email": user["email"]}
    return None


def get_user_by_id(user_id: int) -> Optional[Dict]:
    """Get user by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, full_name, email, created_at FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    if user:
        return dict(user)
    return None


# ── Health Profile Operations ──

def get_health_profile(user_id: int) -> Optional[Dict]:
    """Get health profile for a user."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT hp.*, u.full_name, u.email 
           FROM health_profiles hp 
           JOIN users u ON hp.user_id = u.id 
           WHERE hp.user_id = ?""",
        (user_id,)
    )
    profile = cursor.fetchone()
    conn.close()

    if profile:
        result = dict(profile)
        # Parse allergies JSON
        if isinstance(result.get("allergies"), str):
            result["allergies"] = json.loads(result["allergies"])
        return result
    return None


def update_health_profile(user_id: int, profile_data: Dict) -> bool:
    """Update health profile for a user."""
    conn = get_connection()
    cursor = conn.cursor()

    # Convert allergies list to JSON
    allergies = profile_data.get("allergies", [])
    if isinstance(allergies, list):
        allergies = json.dumps(allergies)

    cursor.execute(
        """UPDATE health_profiles SET 
           allergies = ?,
           height = ?,
           weight = ?,
           age = ?,
           dietary_preference = ?,
           other_allergy = ?,
           other_diet = ?,
           sensitivities = ?,
           updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?""",
        (
            allergies,
            profile_data.get("height"),
            profile_data.get("weight"),
            profile_data.get("age"),
            profile_data.get("dietary_preference"),
            profile_data.get("other_allergy"),
            profile_data.get("other_diet"),
            profile_data.get("sensitivities"),
            user_id
        )
    )
    conn.commit()
    conn.close()
    return True


# ── Scan History Operations ──

def save_scan(user_id: int, scan_data: Dict) -> int:
    """Save a product scan to history."""
    conn = get_connection()
    cursor = conn.cursor()

    risks = scan_data.get("risks", [])
    if isinstance(risks, list):
        risks = json.dumps(risks)

    cursor.execute(
        """INSERT INTO scan_history (user_id, product_name, barcode, ingredients, health_score, risks)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            user_id,
            scan_data.get("product_name"),
            scan_data.get("barcode"),
            scan_data.get("ingredients"),
            scan_data.get("health_score"),
            risks
        )
    )
    scan_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return scan_id


def get_scan_history(user_id: int, limit: int = 20) -> List[Dict]:
    """Get scan history for a user."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT * FROM scan_history WHERE user_id = ? ORDER BY scanned_at DESC LIMIT ?""",
        (user_id, limit)
    )
    scans = [dict(row) for row in cursor.fetchall()]
    conn.close()

    for scan in scans:
        if isinstance(scan.get("risks"), str):
            scan["risks"] = json.loads(scan["risks"])
    return scans


# ── Allergen Reference Operations ──

def seed_allergens():
    """Seed the allergens reference table with common allergens."""
    common_allergens = [
        ("Milk", "Dairy", "Milk protein allergy", "Milk, cheese, yogurt, butter, cream"),
        ("Eggs", "Eggs", "Egg allergy", "Eggs, mayonnaise, baked goods, pasta"),
        ("Peanuts", "Legumes", "Peanut allergy", "Peanuts, peanut butter, peanut oil"),
        ("Tree Nuts", "Nuts", "Tree nut allergy", "Almonds, walnuts, cashews, pistachios"),
        ("Soy", "Legumes", "Soy allergy", "Soy sauce, tofu, edamame, soy milk"),
        ("Wheat", "Grains", "Wheat allergy / Celiac disease", "Bread, pasta, cereals, flour"),
        ("Gluten", "Grains", "Gluten sensitivity / Celiac disease", "Wheat, barley, rye, malt"),
        ("Fish", "Seafood", "Fish allergy", "Salmon, tuna, cod, mackerel"),
        ("Shellfish", "Seafood", "Shellfish allergy", "Shrimp, crab, lobster, clams"),
        ("Sesame", "Seeds", "Sesame allergy", "Sesame seeds, tahini, hummus"),
        ("Mustard", "Seeds", "Mustard allergy", "Mustard seeds, mustard sauce, pickles"),
        ("Sulfites", "Preservatives", "Sulfite sensitivity", "Dried fruits, wine, pickled foods"),
        ("Lactose", "Dairy", "Lactose intolerance", "Milk, cheese, ice cream, cream sauces"),
        ("MSG", "Additives", "MSG sensitivity", "Flavor enhancer in processed foods, chips, seasonings"),
        ("Food Coloring", "Additives", "Artificial color sensitivity", "Candies, drinks, baked goods, cereals"),
    ]

    conn = get_connection()
    cursor = conn.cursor()

    for name, category, description, sources in common_allergens:
        cursor.execute(
            """INSERT OR IGNORE INTO allergens (name, category, description, common_sources) 
               VALUES (?, ?, ?, ?)""",
            (name, category, description, sources)
        )

    conn.commit()
    conn.close()


def get_all_allergens() -> List[Dict]:
    """Get all allergens from the reference table."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM allergens ORDER BY category, name")
    allergens = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return allergens


def create_order(user_id: int, total_price: float, items_count: int, items: List[Dict]) -> int:
    """Create a new order with its items in a transaction."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        # Insert order
        cursor.execute(
            "INSERT INTO orders (user_id, total_price, items_count) VALUES (?, ?, ?)",
            (user_id, total_price, items_count)
        )
        order_id = cursor.lastrowid
        
        # Insert items
        for item in items:
            cursor.execute(
                """INSERT INTO order_items (order_id, barcode, product_name, brand, quantity, price)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    order_id,
                    item.get("barcode"),
                    item.get("product_name"),
                    item.get("brand"),
                    item.get("quantity"),
                    item.get("price")
                )
            )
        conn.commit()
        return order_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_user_orders(user_id: int) -> List[Dict]:
    """Get all orders and their items for a user."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Get orders
        cursor.execute(
            "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        orders = [dict(row) for row in cursor.fetchall()]
        
        # Get items for each order
        for order in orders:
            cursor.execute(
                "SELECT * FROM order_items WHERE order_id = ?",
                (order["id"],)
            )
            order["items"] = [dict(row) for row in cursor.fetchall()]
        return orders
    finally:
        conn.close()


# Initialize the database when module is imported
init_db()
seed_allergens()
