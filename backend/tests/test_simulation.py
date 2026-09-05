"""Tests for POST /api/route-configs/{id}/simulation and list/get behaviour.

Verifies:
- Admin RBAC (401 without token, 403 with non-admin token, 404 with unknown id).
- Simulation writes sim_stops/sim_summary/sim_updated_at WITHOUT touching original stops.
- GET /api/route-configs (list) strips sim_stops and stops, but returns sim_summary.
- GET /api/route-configs/{id} returns full sim_stops + original stops intact.
"""

import os
import uuid
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USERNAME = "5708699"
ADMIN_PASSWORD = "16288959"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def driver_token(admin_headers):
    # Create/get a spare driver 9902 to have a non-admin token
    uname = "9902"
    users = requests.get(f"{API}/users", headers=admin_headers, timeout=30).json()
    existing = next((u for u in users if u.get("username") == uname), None)
    if not existing:
        payload = {
            "username": uname, "password": "2002",
            "nombres": "TEST_Sim", "apellidos": "Driver",
            "role": "driver",
        }
        r = requests.post(f"{API}/users", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
    r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "2002"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def sample_route(admin_headers):
    """Create a fresh route_config with 2 original stops (no driver assigned)."""
    body = {
        "number": f"SIM{uuid.uuid4().hex[:5]}",
        "driver_id": None,
        "load_time": "05:00",
        "dock": 3,
        "departure_time": "06:00",
    }
    r = requests.post(f"{API}/route-configs", headers=admin_headers, json=body, timeout=30)
    assert r.status_code in (200, 201), r.text
    rc = r.json()
    rid = rc["id"]

    # Seed original stops directly via DB-equivalent PUT? There is no direct API; use stops-endpoint would need an Excel.
    # Instead, we call the simulation endpoint AGAINST a route that has empty stops
    # and verify stops stays empty (i.e. not overwritten with sim_stops).
    yield rc
    requests.delete(f"{API}/route-configs/{rid}", headers=admin_headers, timeout=30)


# --- Auth / RBAC ---

def test_simulation_requires_auth(sample_route):
    r = requests.post(f"{API}/route-configs/{sample_route['id']}/simulation",
                      json={"stops": [], "summary": {}}, timeout=30)
    assert r.status_code == 401


def test_simulation_forbidden_for_driver(sample_route, driver_token):
    r = requests.post(
        f"{API}/route-configs/{sample_route['id']}/simulation",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"stops": [], "summary": {}},
        timeout=30,
    )
    assert r.status_code == 403


def test_simulation_not_found(admin_headers):
    r = requests.post(
        f"{API}/route-configs/does-not-exist-{uuid.uuid4().hex}/simulation",
        headers=admin_headers, json={"stops": [], "summary": {}}, timeout=30,
    )
    assert r.status_code == 404


# --- Save and persistence ---

def test_save_simulation_persists_and_does_not_touch_stops(admin_headers, sample_route):
    rid = sample_route["id"]
    # Snapshot original stops
    original = requests.get(f"{API}/route-configs/{rid}", headers=admin_headers, timeout=30).json()
    original_stops = original.get("stops", [])

    sim_payload = {
        "stops": [
            {"id": "a", "name": "SIM_A", "address": "addr A", "lat": 41.37, "lon": 2.12,
             "window_from": "08:00", "window_to": "22:00"},
            {"id": "b", "name": "SIM_B", "address": "addr B", "lat": 41.38, "lon": 2.13},
        ],
        "summary": {"distance": 12345, "duration": 678, "extra": "ok"},
    }
    r = requests.post(f"{API}/route-configs/{rid}/simulation",
                      headers=admin_headers, json=sim_payload, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sim_summary"]["distance"] == 12345
    assert body["sim_summary"]["duration"] == 678
    assert len(body["sim_stops"]) == 2
    assert "sim_updated_at" in body
    # Original stops UNTOUCHED
    assert body.get("stops", []) == original_stops

    # Fresh GET
    r2 = requests.get(f"{API}/route-configs/{rid}", headers=admin_headers, timeout=30)
    assert r2.status_code == 200
    doc = r2.json()
    assert doc.get("stops", []) == original_stops
    assert len(doc["sim_stops"]) == 2
    assert doc["sim_summary"]["distance"] == 12345
    assert doc["sim_stops"][0]["name"] == "SIM_A"


def test_list_route_configs_strips_stops_but_keeps_sim_summary(admin_headers, sample_route):
    rid = sample_route["id"]
    # Ensure a simulation exists
    sim_payload = {"stops": [{"name": "X", "address": "x", "lat": 41.37, "lon": 2.12}],
                   "summary": {"distance": 999, "duration": 111}}
    r = requests.post(f"{API}/route-configs/{rid}/simulation",
                      headers=admin_headers, json=sim_payload, timeout=30)
    assert r.status_code == 200, r.text

    lst = requests.get(f"{API}/route-configs", headers=admin_headers, timeout=30).json()
    target = next((d for d in lst if d["id"] == rid), None)
    assert target is not None
    assert "stops" not in target
    assert "sim_stops" not in target
    assert target.get("sim_summary", {}).get("distance") == 999
    assert target.get("sim_summary", {}).get("duration") == 111


def test_simulation_overwrites_previous_sim(admin_headers, sample_route):
    rid = sample_route["id"]
    p1 = {"stops": [{"name": "A", "address": "a", "lat": 41.0, "lon": 2.0}],
          "summary": {"distance": 1, "duration": 1}}
    p2 = {"stops": [{"name": "B", "address": "b", "lat": 41.1, "lon": 2.1},
                    {"name": "C", "address": "c", "lat": 41.2, "lon": 2.2}],
          "summary": {"distance": 2, "duration": 2}}
    requests.post(f"{API}/route-configs/{rid}/simulation", headers=admin_headers, json=p1, timeout=30)
    r = requests.post(f"{API}/route-configs/{rid}/simulation", headers=admin_headers, json=p2, timeout=30)
    assert r.status_code == 200
    doc = requests.get(f"{API}/route-configs/{rid}", headers=admin_headers, timeout=30).json()
    assert len(doc["sim_stops"]) == 2
    assert doc["sim_summary"]["distance"] == 2
