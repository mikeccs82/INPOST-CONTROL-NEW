"""Tests for the NEW warehouse (salida/llegada) settings + service-time feature."""
import time

import pytest

from conftest import API

# Barcelona-area warehouse points
START = {"name": "TEST_Almacen Salida", "address": "Zona Franca, Barcelona", "lat": 41.3300, "lon": 2.1300}
END = {"name": "TEST_Almacen Llegada", "address": "Sant Adria, Barcelona", "lat": 41.4300, "lon": 2.2200}


def _retry(fn, attempts=2, wait=3):
    last = None
    for _ in range(attempts):
        try:
            r = fn()
            if r.status_code < 500:
                return r
            last = r
        except Exception as e:
            last = e
        time.sleep(wait)
    if isinstance(last, Exception):
        raise last
    return last


# ------------------------- /api/settings -------------------------
class TestSettings:
    def test_get_settings_shape(self, api_client):
        r = api_client.get(f"{API}/settings", timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "_id" not in d
        for k in ("start", "end", "same_as_start", "service_time_min"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["same_as_start"], bool)
        assert isinstance(d["service_time_min"], (int, float))

    def test_put_then_get_roundtrip(self, api_client):
        payload = {"start": START, "end": None, "same_as_start": True, "service_time_min": 7}
        p = api_client.put(f"{API}/settings", json=payload, timeout=30)
        assert p.status_code == 200, p.text[:300]
        pd_ = p.json()
        assert pd_["start"]["address"] == START["address"]
        assert pd_["start"]["lat"] == pytest.approx(START["lat"])
        assert pd_["same_as_start"] is True
        assert pd_["service_time_min"] == 7
        assert pd_.get("updated_at")

        g = api_client.get(f"{API}/settings", timeout=30).json()
        assert g["start"]["address"] == START["address"]
        assert g["start"]["lat"] == pytest.approx(START["lat"])
        assert g["service_time_min"] == 7
        assert g["same_as_start"] is True
        assert g["end"] is None
        assert isinstance(g["start"].get("id"), str) and g["start"]["id"]

    def test_put_distinct_end_persists(self, api_client):
        payload = {"start": START, "end": END, "same_as_start": False, "service_time_min": 12.5}
        p = api_client.put(f"{API}/settings", json=payload, timeout=30)
        assert p.status_code == 200
        g = api_client.get(f"{API}/settings", timeout=30).json()
        assert g["same_as_start"] is False
        assert g["end"]["lat"] == pytest.approx(END["lat"])
        assert g["end"]["address"] == END["address"]
        assert g["service_time_min"] == 12.5

    def test_put_upserts_single_doc(self, api_client):
        # write twice, GET must reflect only the last write
        api_client.put(f"{API}/settings", json={"start": START, "same_as_start": True, "service_time_min": 1},
                       timeout=30)
        api_client.put(f"{API}/settings", json={"start": None, "same_as_start": True, "service_time_min": 3},
                       timeout=30)
        g = api_client.get(f"{API}/settings", timeout=30).json()
        assert g["service_time_min"] == 3
        assert g["start"] is None

    def test_put_invalid_start_422(self, api_client):
        r = api_client.put(f"{API}/settings", json={"start": {"lat": 41.0}}, timeout=30)
        assert r.status_code == 422


# ------------------------- /api/optimize with warehouse -------------------------
class TestOptimizeWarehouse:
    def _opt(self, api_client, body):
        return _retry(lambda: api_client.post(f"{API}/optimize", json=body, timeout=120))

    def test_start_only_round_trip_order_excludes_warehouse(self, api_client, sample_stops):
        body = {"stops": sample_stops, "start": START, "round_trip": True,
                "metric": "duration", "service_time_min": 8}
        r = self._opt(api_client, body)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        ids = [s["id"] for s in sample_stops]
        assert sorted(d["order"]) == sorted(ids), "order must contain only the delivery stop ids"
        assert len(d["order"]) == len(ids)
        assert d["round_trip"] is True
        s = d["summary"]
        assert s["stops"] == len(sample_stops)
        assert s["service_duration"] == pytest.approx(8 * 60 * len(sample_stops))
        assert s["duration"] == pytest.approx(s["drive_duration"] + s["service_duration"])
        assert s["drive_duration"] > 0 and s["distance"] > 0
        # geometry starts and ends near the warehouse (round trip)
        lon0, lat0 = d["geometry"][0]
        lonN, latN = d["geometry"][-1]
        assert abs(lat0 - START["lat"]) < 0.02 and abs(lon0 - START["lon"]) < 0.02, (lat0, lon0)
        assert abs(latN - START["lat"]) < 0.02 and abs(lonN - START["lon"]) < 0.02, (latN, lonN)

    def test_start_only_distance_metric(self, api_client, sample_stops):
        body = {"stops": sample_stops, "start": START, "round_trip": True,
                "metric": "distance", "service_time_min": 5}
        r = self._opt(api_client, body)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert sorted(d["order"]) == sorted([s["id"] for s in sample_stops])
        s = d["summary"]
        assert s["service_duration"] == pytest.approx(5 * 60 * len(sample_stops))
        assert s["duration"] == pytest.approx(s["drive_duration"] + s["service_duration"])
        assert s["distance"] > 0

    def test_zero_service_time_default(self, api_client, sample_stops):
        r = self._opt(api_client, {"stops": sample_stops, "start": START, "round_trip": True})
        assert r.status_code == 200, r.text[:400]
        s = r.json()["summary"]
        assert s["service_duration"] == 0
        assert s["duration"] == pytest.approx(s["drive_duration"])

    def test_start_and_distinct_end_open_path(self, api_client, sample_stops):
        body = {"stops": sample_stops, "start": START, "end": END, "round_trip": True,
                "metric": "duration", "service_time_min": 4}
        r = self._opt(api_client, body)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert sorted(d["order"]) == sorted([s["id"] for s in sample_stops])
        assert d["round_trip"] is False, "with a distinct end the path must be open"
        lon0, lat0 = d["geometry"][0]
        lonN, latN = d["geometry"][-1]
        assert abs(lat0 - START["lat"]) < 0.02 and abs(lon0 - START["lon"]) < 0.02
        assert abs(latN - END["lat"]) < 0.02 and abs(lonN - END["lon"]) < 0.02, (latN, lonN)
        s = d["summary"]
        assert s["duration"] == pytest.approx(s["drive_duration"] + 4 * 60 * len(sample_stops))

    def test_start_no_round_trip_open_path(self, api_client, sample_stops):
        r = self._opt(api_client, {"stops": sample_stops, "start": START, "round_trip": False})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["round_trip"] is False
        lonN, latN = d["geometry"][-1]
        assert not (abs(latN - START["lat"]) < 0.005 and abs(lonN - START["lon"]) < 0.005), \
            "one-way route should not end at the warehouse"

    def test_start_with_single_stop_ok(self, api_client, sample_stops):
        r = self._opt(api_client, {"stops": sample_stops[:1], "start": START, "round_trip": True})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["order"] == [sample_stops[0]["id"]]

    def test_fallback_without_start_backward_compatible(self, api_client, sample_stops):
        r = self._opt(api_client, {"stops": sample_stops, "depot_index": 0, "round_trip": True,
                                   "service_time_min": 6})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["order"][0] == sample_stops[0]["id"]
        assert len(d["order"]) == len(sample_stops)
        s = d["summary"]
        assert s["service_duration"] == pytest.approx(6 * 60 * len(sample_stops))
        assert s["duration"] == pytest.approx(s["drive_duration"] + s["service_duration"])

    def test_fallback_single_stop_400(self, api_client, sample_stops):
        r = api_client.post(f"{API}/optimize", json={"stops": sample_stops[:1]}, timeout=60)
        assert r.status_code == 400

    def test_round_trip_not_cheaper_than_open(self, api_client, sample_stops):
        rt = self._opt(api_client, {"stops": sample_stops, "start": START, "round_trip": True}).json()
        ow = self._opt(api_client, {"stops": sample_stops, "start": START, "round_trip": False}).json()
        assert rt["summary"]["distance"] >= ow["summary"]["distance"]


# ------------------------- /api/route with warehouse -------------------------
class TestRouteWarehouse:
    def test_route_with_start_and_service_time(self, api_client, sample_stops):
        body = {"stops": sample_stops, "start": START, "round_trip": True, "service_time_min": 10}
        r = _retry(lambda: api_client.post(f"{API}/route", json=body, timeout=90))
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["order"] == [s["id"] for s in sample_stops]
        s = d["summary"]
        assert s["stops"] == len(sample_stops)
        assert s["service_duration"] == pytest.approx(10 * 60 * len(sample_stops))
        assert s["duration"] == pytest.approx(s["drive_duration"] + s["service_duration"])
        lon0, lat0 = d["geometry"][0]
        lonN, latN = d["geometry"][-1]
        assert abs(lat0 - START["lat"]) < 0.02
        assert abs(latN - START["lat"]) < 0.02, "round trip must come back to the warehouse"

    def test_route_with_distinct_end(self, api_client, sample_stops):
        body = {"stops": sample_stops, "start": START, "end": END, "round_trip": True, "service_time_min": 0}
        r = _retry(lambda: api_client.post(f"{API}/route", json=body, timeout=90))
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        lonN, latN = d["geometry"][-1]
        assert abs(latN - END["lat"]) < 0.02 and abs(lonN - END["lon"]) < 0.02

    def test_route_start_plus_one_stop(self, api_client, sample_stops):
        r = _retry(lambda: api_client.post(
            f"{API}/route", json={"stops": sample_stops[:1], "start": START, "round_trip": False}, timeout=90))
        assert r.status_code == 200, r.text[:400]
        assert r.json()["summary"]["distance"] > 0

    def test_route_no_points_400(self, api_client):
        r = api_client.post(f"{API}/route", json={"stops": []}, timeout=30)
        assert r.status_code == 400


# ------------------------- /api/routes persistence of warehouse fields -------------------------
class TestSavedRouteWarehouse:
    def test_save_with_warehouse_and_get(self, api_client, sample_stops, created_route_ids):
        payload = {"name": "TEST_wh_ruta", "stops": sample_stops, "metric": "duration", "round_trip": True,
                   "start": START, "end": END, "service_time_min": 9}
        r = api_client.post(f"{API}/routes", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        rid = d["id"]
        created_route_ids.append(rid)
        assert d["start"]["lat"] == pytest.approx(START["lat"])
        assert d["end"]["address"] == END["address"]
        assert d["service_time_min"] == 9

        g = api_client.get(f"{API}/routes/{rid}", timeout=60).json()
        assert "_id" not in g
        assert g["start"]["address"] == START["address"]
        assert g["end"]["lon"] == pytest.approx(END["lon"])
        assert g["service_time_min"] == 9

    def test_update_warehouse_fields(self, api_client, sample_stops, created_route_ids):
        rid = created_route_ids[0]
        payload = {"name": "TEST_wh_ruta_upd", "stops": sample_stops[:3], "start": END, "end": None,
                   "service_time_min": 2}
        r = api_client.put(f"{API}/routes/{rid}", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:400]
        g = api_client.get(f"{API}/routes/{rid}", timeout=60).json()
        assert g["name"] == "TEST_wh_ruta_upd"
        assert g["start"]["lat"] == pytest.approx(END["lat"])
        assert g["end"] is None
        assert g["service_time_min"] == 2
        assert len(g["stops"]) == 3
