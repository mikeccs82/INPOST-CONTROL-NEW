import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing from env and /app/frontend/.env")
BASE_URL = _base.rstrip("/")
API = f"{BASE_URL}/api"

SAMPLE_XLSX = "/app/sample_stops.xlsx"

# Small set of real Barcelona-area coordinates (from sample data) used for routing tests
SAMPLE_STOPS = [
    {"id": "s0", "name": "Depot", "address": "A", "lat": 41.36948, "lon": 2.12353},
    {"id": "s1", "name": "B", "address": "B", "lat": 41.372095, "lon": 2.124075},
    {"id": "s2", "name": "C", "address": "C", "lat": 41.373689, "lon": 2.122336},
    {"id": "s3", "name": "D", "address": "D", "lat": 41.3556, "lon": 2.1075},
    {"id": "s4", "name": "E", "address": "E", "lat": 41.3851, "lon": 2.1734},
]


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    return s


@pytest.fixture(scope="session")
def sample_stops():
    return [dict(s) for s in SAMPLE_STOPS]


@pytest.fixture(scope="module")
def created_route_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup_routes(api_client, created_route_ids):
    yield
    for rid in created_route_ids:
        try:
            api_client.delete(f"{API}/routes/{rid}", timeout=30)
        except Exception:
            pass
