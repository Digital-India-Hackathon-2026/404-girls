import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_product_endpoint_accepts_post_for_barcode_lookup():
    response = client.post('/api/product/8901030895489', json={'preferences': {}})
    assert response.status_code in {200, 404}
