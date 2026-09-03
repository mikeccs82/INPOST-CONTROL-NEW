"""Backend API tests for the Route Optimizer (OSM/Nominatim/OSRM based)."""
import io
import time

import pytest

from conftest import API, SAMPLE_XLSX


def _retry(fn, attempts=2, wait=2):
    last = None
    for i in range(attempts):
        try:
            r = fn()
            if r.status_code < 500:
                return r
            last = r
        except Exception as e:  # network flakiness on public APIs
            last = e
        time.sleep(wait)
    if isinstance(last, Exception):
        raise last
    return last


# ------------------------- Health -------------------------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        assert r.json().get("message") == "Route Optimizer API"


# ------------------------- Geocoding (Nominatim) -------------------------
class TestGeocode:
    def test_geocode_spain_address(self, api_client):
        r = _retry(lambda: api_client.get(f"{API}/geocode", params={"q": "Gran Via 1, Madrid"}, timeout=60))
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Nominatim returned no results for a valid Spanish address"
        first = data[0]
        assert set(["display_name", "lat", "lon"]).issubset(first.keys())
        assert isinstance(first["lat"], float) and isinstance(first["lon"], float)
        # Spain bounding box sanity (mainland + islands)
        assert 27 < first["lat"] < 44, first
        assert -19 < first["lon"] < 5, first

    def test_geocode_short_query_returns_empty(self, api_client):
        r = api_client.get(f"{API}/geocode", params={"q": "ab"}, timeout=30)
        assert r.status_code == 200
        assert r.json() == []

    def test_geocode_missing_param_422(self, api_client):
        r = api_client.get(f"{API}/geocode", timeout=30)
        assert r.status_code == 422

    def test_geocode_limit_respected(self, api_client):
        r = _retry(lambda: api_client.get(f"{API}/geocode", params={"q": "Calle Mayor, Madrid", "limit": 2}, timeout=60))
        assert r.status_code == 200
        assert len(r.json()) <= 2


# ------------------------- Optimize (OSRM table + NN + 2-opt) -------------------------
class TestOptimize:
    def _optimize(self, api_client, stops, metric="duration", round_trip=True, depot_index=0):
        return _retry(lambda: api_client.post(
            f"{API}/optimize",
            json={"stops": stops, "depot_index": depot_index, "metric": metric, "round_trip": round_trip},
            timeout=120,
        ))

    def test_optimize_duration_round_trip(self, api_client, sample_stops):
        r = self._optimize(api_client, sample_stops, "duration", True)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["order"][0] == "s0", "Depot must stay first in optimized order"
        assert sorted(d["order"]) == sorted([s["id"] for s in sample_stops])
        assert len(d["order"]) == len(sample_stops)
        assert d["summary"]["stops"] == len(sample_stops)
        assert d["summary"]["distance"] > 0
        assert d["summary"]["duration"] > 0
        assert isinstance(d["geometry"], list) and len(d["geometry"]) > 2
        lon, lat = d["geometry"][0]
        assert -19 < lon < 5 and 27 < lat < 44, "geometry must be [lon,lat] pairs"

    def test_optimize_distance_metric(self, api_client, sample_stops):
        r = self._optimize(api_client, sample_stops, "distance", True)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["order"][0] == "s0"
        assert d["summary"]["distance"] > 0

    def test_optimize_one_way(self, api_client, sample_stops):
        r = self._optimize(api_client, sample_stops, "duration", False)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["round_trip"] is False
        assert d["order"][0] == "s0"
        assert len(d["order"]) == len(sample_stops)

    def test_round_trip_costs_more_than_one_way(self, api_client, sample_stops):
        rt = self._optimize(api_client, sample_stops, "duration", True).json()
        ow = self._optimize(api_client, sample_stops, "duration", False).json()
        assert rt["summary"]["distance"] >= ow["summary"]["distance"]

    def test_optimize_respects_depot_index(self, api_client, sample_stops):
        r = self._optimize(api_client, sample_stops, "duration", True, depot_index=3)
        assert r.status_code == 200, r.text[:400]
        assert r.json()["order"][0] == "s3"

    def test_optimize_single_stop_400(self, api_client, sample_stops):
        r = api_client.post(f"{API}/optimize", json={"stops": sample_stops[:1]}, timeout=60)
        assert r.status_code == 400

    def test_optimize_invalid_payload_422(self, api_client):
        r = api_client.post(f"{API}/optimize", json={"stops": [{"lat": 41.0}]}, timeout=30)
        assert r.status_code == 422


# ------------------------- Route (manual order) -------------------------
class TestRoute:
    def test_route_ordered(self, api_client, sample_stops):
        r = _retry(lambda: api_client.post(f"{API}/route", json={"stops": sample_stops}, timeout=90))
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["order"] == [s["id"] for s in sample_stops], "route must preserve given order"
        assert d["summary"]["distance"] > 0 and d["summary"]["duration"] > 0
        assert len(d["geometry"]) > 2

    def test_route_min_two_stops(self, api_client, sample_stops):
        # Open path with a single stop still needs >=2 points -> 400
        r = api_client.post(f"{API}/route", json={"stops": sample_stops[:1], "round_trip": False}, timeout=60)
        assert r.status_code == 400

    def test_route_single_stop_round_trip_degenerate(self, api_client, sample_stops):
        # NOTE (behaviour change with the warehouse feature): a single stop with round_trip=True
        # is treated as stop -> stop and returns a zero-length route instead of a 400.
        r = _retry(lambda: api_client.post(f"{API}/route", json={"stops": sample_stops[:1]}, timeout=60))
        assert r.status_code == 200, r.text[:300]
        assert r.json()["summary"]["distance"] == 0


# ------------------------- Excel import -------------------------
class TestImportExcel:
    def test_import_sample_xlsx(self, api_client):
        with open(SAMPLE_XLSX, "rb") as f:
            files = {"file": ("sample_stops.xlsx", f.read(),
                              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = api_client.post(f"{API}/import-excel", files=files, timeout=300)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["total"] == 36, d["total"]
        # New response shape (round 3): resolved / pending instead of stops / skipped
        assert d["resolved_count"] + d["pending_count"] == d["total"]
        assert len(d["resolved"]) >= 30
        s = d["resolved"][0]
        for key in ("id", "name", "address", "lat", "lon", "order_id", "window_from", "window_to", "stop_type"):
            assert key in s, f"missing {key}"
        assert isinstance(s["lat"], float) and isinstance(s["lon"], float)
        assert s["address"], "address should be populated from the Spanish 'Dirección' column"
        assert s["name"], "name should be populated from 'Nombre de ubicación'"
        assert s["order_id"], "order_id should map from 'ID de orden'"
        assert 27 < s["lat"] < 44 and -19 < s["lon"] < 5
        ids = [x["id"] for x in d["resolved"]]
        assert len(ids) == len(set(ids)), "stop ids must be unique"

    def test_import_invalid_file_400(self, api_client):
        files = {"file": ("bad.xlsx", io.BytesIO(b"not an excel"), "application/vnd.ms-excel")}
        r = api_client.post(f"{API}/import-excel", files=files, timeout=60)
        assert r.status_code == 400

    def test_import_no_file_422(self, api_client):
        r = api_client.post(f"{API}/import-excel", timeout=30)
        assert r.status_code == 422


# ------------------------- Saved routes CRUD -------------------------
class TestRoutesCRUD:
    def test_create_and_get(self, api_client, sample_stops, created_route_ids):
        payload = {"name": "TEST_ruta_crud", "stops": sample_stops, "metric": "distance", "round_trip": False,
                   "depot_index": 0}
        r = api_client.post(f"{API}/routes", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert "_id" not in d
        assert d["name"] == "TEST_ruta_crud"
        assert d["metric"] == "distance"
        assert d["round_trip"] is False
        assert len(d["stops"]) == len(sample_stops)
        assert isinstance(d["id"], str) and len(d["id"]) > 10
        rid = d["id"]
        created_route_ids.append(rid)

        g = api_client.get(f"{API}/routes/{rid}", timeout=60)
        assert g.status_code == 200
        gd = g.json()
        assert "_id" not in gd
        assert gd["id"] == rid
        assert gd["name"] == "TEST_ruta_crud"
        assert gd["stops"][0]["lat"] == pytest.approx(sample_stops[0]["lat"])
        assert gd["created_at"] and gd["updated_at"]

    def test_list_contains_created(self, api_client, created_route_ids):
        assert created_route_ids, "create test must run first"
        r = api_client.get(f"{API}/routes", timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(x["id"] == created_route_ids[0] for x in data)
        assert all("_id" not in x for x in data)

    def test_update_and_persist(self, api_client, sample_stops, created_route_ids):
        rid = created_route_ids[0]
        payload = {"name": "TEST_ruta_actualizada", "stops": sample_stops[:3], "metric": "duration",
                   "round_trip": True, "depot_index": 0}
        r = api_client.put(f"{API}/routes/{rid}", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["name"] == "TEST_ruta_actualizada"
        assert len(d["stops"]) == 3
        assert d["metric"] == "duration"

        g = api_client.get(f"{API}/routes/{rid}", timeout=60).json()
        assert g["name"] == "TEST_ruta_actualizada"
        assert len(g["stops"]) == 3
        assert g["round_trip"] is True

    def test_get_missing_404(self, api_client):
        r = api_client.get(f"{API}/routes/does-not-exist", timeout=30)
        assert r.status_code == 404

    def test_update_missing_404(self, api_client, sample_stops):
        r = api_client.put(f"{API}/routes/does-not-exist",
                           json={"name": "x", "stops": sample_stops[:2]}, timeout=30)
        assert r.status_code == 404

    def test_delete_and_verify(self, api_client, sample_stops):
        c = api_client.post(f"{API}/routes", json={"name": "TEST_borrar", "stops": sample_stops[:2]}, timeout=60)
        assert c.status_code == 200
        rid = c.json()["id"]
        d = api_client.delete(f"{API}/routes/{rid}", timeout=60)
        assert d.status_code == 200
        assert d.json().get("ok") is True
        assert api_client.get(f"{API}/routes/{rid}", timeout=30).status_code == 404
        assert api_client.delete(f"{API}/routes/{rid}", timeout=30).status_code == 404


# ------------------------- Export -------------------------
class TestExport:
    def test_export_xlsx(self, api_client, sample_stops):
        r = api_client.post(f"{API}/export", json={"stops": sample_stops}, timeout=90)
        assert r.status_code == 200, r.text[:300]
        assert "spreadsheetml" in r.headers.get("content-type", "")
        assert "ruta_optimizada.xlsx" in r.headers.get("content-disposition", "")
        assert r.content[:2] == b"PK", "not a valid xlsx zip payload"

        import pandas as pd
        df = pd.read_excel(io.BytesIO(r.content))
        assert list(df["Orden"]) == list(range(1, len(sample_stops) + 1))
        assert "Dirección" in df.columns and "Latitud" in df.columns
        assert df["Latitud"].iloc[0] == pytest.approx(sample_stops[0]["lat"])
