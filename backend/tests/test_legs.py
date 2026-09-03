"""Tests for per-leg geometry in /api/optimize and /api/route, plus settings persistence."""
import pytest
from conftest import API


def _post(client, path, payload, retries=1):
    last = None
    for _ in range(retries + 1):
        r = client.post(f"{API}{path}", json=payload, timeout=90)
        last = r
        if r.status_code == 200:
            return r
    return last


# --- /api/optimize legs + warehouse + service time ---
class TestOptimizeLegs:
    def test_optimize_with_start_returns_legs_and_service(self, api_client, sample_stops):
        depot = sample_stops[0]
        stops = sample_stops[1:]
        payload = {
            "stops": stops,
            "metric": "duration",
            "round_trip": True,
            "start": {**depot, "id": "wh-start"},
            "service_time_min": 5,
        }
        r = _post(api_client, "/optimize", payload)
        assert r.status_code == 200, r.text[:400]
        data = r.json()

        # order excludes warehouse
        assert set(data["order"]) == {s["id"] for s in stops}
        assert "wh-start" not in data["order"]

        s = data["summary"]
        assert s["stops"] == len(stops)
        assert s["service_duration"] == pytest.approx(5 * 60 * len(stops))
        assert s["duration"] == pytest.approx(s["drive_duration"] + s["service_duration"])
        assert s["distance"] > 0

        # legs: start + stops + return  => len(stops)+1 segments
        legs = data["legs"]
        assert isinstance(legs, list)
        expected = len(stops) + 1 if data["round_trip"] else len(stops)
        assert len(legs) == expected, f"expected {expected} legs, got {len(legs)}"
        for leg in legs:
            assert isinstance(leg, list) and len(leg) >= 2
            assert len(leg[0]) == 2

    def test_optimize_no_service_time(self, api_client, sample_stops):
        payload = {"stops": sample_stops, "metric": "distance", "round_trip": False}
        r = _post(api_client, "/optimize", payload)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data["summary"]["service_duration"] == 0
        assert data["summary"]["duration"] == pytest.approx(data["summary"]["drive_duration"])
        assert len(data["legs"]) == len(sample_stops) - 1


# --- /api/route legs ---
class TestRouteLegs:
    def test_route_returns_legs(self, api_client, sample_stops):
        payload = {
            "stops": sample_stops[1:],
            "round_trip": True,
            "start": {**sample_stops[0], "id": "wh-start"},
            "service_time_min": 3,
        }
        r = _post(api_client, "/route", payload)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data["order"] == [s["id"] for s in sample_stops[1:]]
        assert data["summary"]["service_duration"] == pytest.approx(3 * 60 * 4)
        assert len(data["legs"]) == len(sample_stops[1:]) + 1
        assert len(data["geometry"]) > 2


# --- /api/settings persistence ---
class TestSettings:
    def test_put_then_get_settings(self, api_client):
        body = {
            "start": {"id": "wh", "name": "TEST_Almacen", "address": "Carrer de Test 1", "lat": 41.3, "lon": 2.1},
            "end": None,
            "same_as_start": True,
            "service_time_min": 7,
        }
        r = api_client.put(f"{API}/settings", json=body, timeout=30)
        assert r.status_code == 200, r.text[:300]

        g = api_client.get(f"{API}/settings", timeout=30)
        assert g.status_code == 200
        d = g.json()
        assert "_id" not in d
        assert d["same_as_start"] is True
        assert d["service_time_min"] == 7
        assert d["start"]["address"] == "Carrer de Test 1"
        assert d["start"]["lat"] == pytest.approx(41.3)
        assert d["end"] is None
