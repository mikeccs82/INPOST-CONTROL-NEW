"""Backend tests for DRIVERS CRUD and TIME WINDOWS (VRPTW) / schedule features."""
import time

import pytest

from conftest import API


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


# --------------------------- Drivers CRUD ---------------------------
DRIVER_PAYLOAD = {
    "nombres": "TEST_Juan",
    "apellidos": "Perez",
    "dni": "12345678Z",
    "telefono": "600111222",
    "marca": "Mercedes",
    "modelo": "Sprinter",
    "anio": "2021",
    "tamano": "L3H2",
    "matricula": "1234ABC",
}


@pytest.fixture(scope="class")
def created_driver_ids():
    return []


@pytest.fixture(scope="class", autouse=True)
def cleanup_drivers(api_client, created_driver_ids):
    yield
    for did in created_driver_ids:
        try:
            api_client.delete(f"{API}/drivers/{did}", timeout=30)
        except Exception:
            pass


class TestDriversCRUD:
    def test_create_and_list(self, api_client, created_driver_ids):
        r = api_client.post(f"{API}/drivers", json=DRIVER_PAYLOAD, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert isinstance(d.get("id"), str) and len(d["id"]) > 0
        assert "_id" not in d
        created_driver_ids.append(d["id"])
        for k, v in DRIVER_PAYLOAD.items():
            assert d[k] == v, f"field {k} mismatch: {d.get(k)}"
        assert "created_at" in d

        lr = api_client.get(f"{API}/drivers", timeout=30)
        assert lr.status_code == 200
        lst = lr.json()
        assert isinstance(lst, list)
        found = [x for x in lst if x["id"] == d["id"]]
        assert len(found) == 1, "created driver not present in GET /api/drivers"
        assert found[0]["matricula"] == "1234ABC"
        assert all("_id" not in x for x in lst)

    def test_update_driver_persists(self, api_client, created_driver_ids):
        r = api_client.post(f"{API}/drivers", json={**DRIVER_PAYLOAD, "nombres": "TEST_Upd"}, timeout=30)
        assert r.status_code == 200
        did = r.json()["id"]
        created_driver_ids.append(did)

        upd = {**DRIVER_PAYLOAD, "nombres": "TEST_Updated", "telefono": "699999999", "tamano": "L2H1"}
        ur = api_client.put(f"{API}/drivers/{did}", json=upd, timeout=30)
        assert ur.status_code == 200, ur.text[:300]
        u = ur.json()
        assert u["id"] == did
        assert u["nombres"] == "TEST_Updated"
        assert u["telefono"] == "699999999"
        assert u["tamano"] == "L2H1"

        lst = api_client.get(f"{API}/drivers", timeout=30).json()
        got = [x for x in lst if x["id"] == did][0]
        assert got["nombres"] == "TEST_Updated"
        assert got["tamano"] == "L2H1"
        assert got["dni"] == DRIVER_PAYLOAD["dni"]

    def test_delete_driver(self, api_client):
        r = api_client.post(f"{API}/drivers", json={**DRIVER_PAYLOAD, "nombres": "TEST_Del"}, timeout=30)
        did = r.json()["id"]
        dr = api_client.delete(f"{API}/drivers/{did}", timeout=30)
        assert dr.status_code == 200, dr.text[:300]
        assert dr.json().get("ok") is True
        lst = api_client.get(f"{API}/drivers", timeout=30).json()
        assert not any(x["id"] == did for x in lst), "driver still present after delete"

    def test_delete_missing_404(self, api_client):
        r = api_client.delete(f"{API}/drivers/does-not-exist", timeout=30)
        assert r.status_code == 404

    def test_update_missing_404(self, api_client):
        r = api_client.put(f"{API}/drivers/does-not-exist", json=DRIVER_PAYLOAD, timeout=30)
        assert r.status_code == 404

    def test_create_validation_error(self, api_client):
        r = api_client.post(f"{API}/drivers", json={"apellidos": "NoName"}, timeout=30)
        assert r.status_code == 422


# --------------------------- Time windows (VRPTW) ---------------------------
WAREHOUSE = {"id": "wh", "name": "Almacen", "address": "WH", "lat": 41.36948, "lon": 2.12353}
# Three nearby stops in L'Hospitalet; windows force order B -> A -> C
STOP_A = {"id": "A", "name": "A", "address": "A", "lat": 41.3556, "lon": 2.1075,
          "window_from": "09:00", "window_to": "10:00", "service_min": 5}
STOP_B = {"id": "B", "name": "B", "address": "B", "lat": 41.373689, "lon": 2.122336,
          "window_from": "08:00", "window_to": "08:30", "service_min": 5}
STOP_C = {"id": "C", "name": "C", "address": "C", "lat": 41.3851, "lon": 2.1734,
          "window_from": "12:00", "window_to": "13:00", "service_min": 5}


class TestTimeWindows:
    def test_optimize_respects_windows(self, api_client):
        body = {
            "stops": [STOP_A, STOP_C, STOP_B],
            "start": WAREHOUSE,
            "round_trip": True,
            "metric": "duration",
            "departure_time": "07:45",
            "respect_windows": True,
        }
        r = _retry(lambda: api_client.post(f"{API}/optimize", json=body, timeout=180))
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data.get("used_windows") is True, f"used_windows not true: {data.get('used_windows')}"
        assert data["order"] == ["B", "A", "C"], f"order does not respect windows: {data['order']}"

        sched = data.get("schedule")
        assert isinstance(sched, list) and len(sched) == 3
        assert [s["id"] for s in sched] == ["B", "A", "C"]
        for s in sched:
            assert len(s["arrival"]) == 5 and s["arrival"][2] == ":"
            assert isinstance(s["wait_min"], int)
            assert isinstance(s["late"], bool)
        # B window opens 08:00 while departure is 07:45 -> should wait or arrive within window
        assert sched[0]["late"] is False
        # Arrivals must be non-decreasing
        secs = [s["arrival_sec"] for s in sched]
        assert secs == sorted(secs), f"arrival times not monotonic: {secs}"
        # Waiting expected for C (long gap) and probably A
        assert any(s["wait_min"] > 0 for s in sched), "expected waiting for early arrivals"

        summ = data["summary"]
        assert summ["departure"] == "07:45"
        assert len(summ["end_time"]) == 5
        assert summ["late_count"] == 0, f"unexpected late stops: {sched}"
        assert isinstance(data.get("legs"), list) and len(data["legs"]) >= 3

    def test_late_detection_soft_window(self, api_client):
        # Impossible window: C must be reached by 07:46 (unreachable) -> late
        stops = [
            dict(STOP_A),
            {**STOP_C, "window_from": None, "window_to": "07:46"},
            dict(STOP_B),
        ]
        body = {
            "stops": stops,
            "start": WAREHOUSE,
            "round_trip": True,
            "metric": "duration",
            "departure_time": "07:45",
            "respect_windows": True,
        }
        r = _retry(lambda: api_client.post(f"{API}/optimize", json=body, timeout=180))
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data.get("used_windows") is True
        assert len(data["order"]) == 3, "soft windows must still return the full route"
        sched = {s["id"]: s for s in data["schedule"]}
        assert sched["C"]["late"] is True, f"C should be late: {sched['C']}"
        assert data["summary"]["late_count"] >= 1

    def test_optimize_without_windows_flag(self, api_client):
        body = {
            "stops": [STOP_A, STOP_C, STOP_B],
            "start": WAREHOUSE,
            "round_trip": True,
            "metric": "duration",
            "departure_time": "07:45",
            "respect_windows": False,
        }
        r = _retry(lambda: api_client.post(f"{API}/optimize", json=body, timeout=120))
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data.get("used_windows") is False
        assert sorted(data["order"]) == ["A", "B", "C"]
        assert len(data["schedule"]) == 3
        assert data["summary"]["departure"] == "07:45"

    def test_route_schedule_for_given_order(self, api_client):
        body = {
            "stops": [STOP_B, STOP_A, STOP_C],
            "start": WAREHOUSE,
            "round_trip": True,
            "departure_time": "08:15",
        }
        r = _retry(lambda: api_client.post(f"{API}/route", json=body, timeout=120))
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data["order"] == ["B", "A", "C"]
        sched = data["schedule"]
        assert [s["id"] for s in sched] == ["B", "A", "C"]
        assert data["summary"]["departure"] == "08:15"
        assert len(data["summary"]["end_time"]) == 5
        # B window_to is 08:30; departing at 08:15 it should still make it or be flagged
        assert isinstance(sched[0]["late"], bool)
        # A opens 09:00 -> arriving earlier means wait
        assert sched[1]["wait_min"] >= 0
        assert "late_count" in data["summary"]

    def test_route_default_departure(self, api_client):
        body = {"stops": [STOP_B, STOP_A], "start": WAREHOUSE, "round_trip": True}
        r = _retry(lambda: api_client.post(f"{API}/route", json=body, timeout=120))
        assert r.status_code == 200, r.text[:300]
        assert r.json()["summary"]["departure"] == "08:00"


# --------------------------- Settings persistence ---------------------------
class TestSettingsWindows:
    def test_put_get_departure_and_respect(self, api_client):
        prev = api_client.get(f"{API}/settings", timeout=30).json()
        body = {
            "start": WAREHOUSE,
            "same_as_start": True,
            "service_time_min": 5,
            "service_by_type": {"P": 4, "PD": 3, "L": 2},
            "departure_time": "08:00",
            "respect_windows": True,
        }
        r = api_client.put(f"{API}/settings", json=body, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["departure_time"] == "08:00"
        assert d["respect_windows"] is True
        assert "_id" not in d

        g = api_client.get(f"{API}/settings", timeout=30).json()
        assert g["departure_time"] == "08:00"
        assert g["respect_windows"] is True
        assert g["service_by_type"] == {"P": 4, "PD": 3, "L": 2}
        assert "_id" not in g

        # restore previous settings
        prev.pop("id", None)
        prev.pop("updated_at", None)
        api_client.put(f"{API}/settings", json=prev, timeout=30)
