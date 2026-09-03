"""Regression test for duplicate stop id in VRPTW order when no warehouse start is set."""
from conftest import API

STOP_A = {"id": "A", "name": "A", "address": "A", "lat": 41.3556, "lon": 2.1075,
          "window_from": "09:00", "window_to": "10:00", "service_min": 5}
STOP_B = {"id": "B", "name": "B", "address": "B", "lat": 41.373689, "lon": 2.122336,
          "window_from": "08:00", "window_to": "08:30", "service_min": 5}
STOP_C = {"id": "C", "name": "C", "address": "C", "lat": 41.3851, "lon": 2.1734,
          "window_from": "12:00", "window_to": "13:00", "service_min": 5}


def test_optimize_windows_no_warehouse_no_duplicates(api_client):
    body = {
        "stops": [STOP_A, STOP_C, STOP_B],
        "depot_index": 0,
        "round_trip": True,
        "metric": "duration",
        "departure_time": "07:45",
        "respect_windows": True,
    }
    r = api_client.post(f"{API}/optimize", json=body, timeout=180)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    order = data["order"]
    print("used_windows:", data.get("used_windows"), "order:", order)
    assert len(order) == len(set(order)), f"duplicate stop ids in order: {order}"
    assert len(order) == 3, f"order length should equal stop count, got {len(order)}: {order}"
