"""Regression tests for the N+1 optimization on GET /api/route-configs.
Focus: batch-fetch of drivers via $in, correct per-route driver enrichment
across multiple drivers, and that heavy arrays (stops, sim_stops) are stripped
from the list endpoint but present in GET /route-configs/{id}.
"""
import os
import time

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
API = _base.rstrip("/") + "/api"
XLSX = "/app/sample_new.xlsx"
TIMEOUT = 90
ADMIN = {"username": "5708699", "password": "16288959"}


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def drivers(admin):
    """Ensure 2 distinct driver users exist for multi-driver enrichment test."""
    r = admin.get(f"{API}/users", timeout=TIMEOUT)
    assert r.status_code == 200
    have = {u["username"]: u for u in r.json()}
    for uname, nombres in (("9901", "TEST_DrvA"), ("9902", "TEST_DrvB")):
        if uname not in have:
            cr = admin.post(f"{API}/users", json={
                "username": uname, "password": "2002", "nombres": nombres,
                "apellidos": "QA", "matricula": f"QA-{uname}",
            }, timeout=TIMEOUT)
            assert cr.status_code in (200, 201, 400), cr.text[:300]
    users = admin.get(f"{API}/users", timeout=TIMEOUT).json()
    return {u["username"]: u for u in users}


def _free_driver(admin, drivers, uname):
    d = drivers[uname]
    for rc in admin.get(f"{API}/route-configs", timeout=TIMEOUT).json():
        if rc.get("driver_id") == d["id"]:
            admin.delete(f"{API}/route-configs/{rc['id']}", timeout=TIMEOUT)
    return d


@pytest.fixture(scope="module")
def created_ids(admin):
    ids = []
    yield ids
    for cid in ids:
        try:
            admin.delete(f"{API}/route-configs/{cid}", timeout=TIMEOUT)
        except Exception:
            pass


class TestListEnrichmentN1:
    def test_multi_driver_enrichment_no_mixup(self, admin, drivers, created_ids):
        a = _free_driver(admin, drivers, "9901")
        b = _free_driver(admin, drivers, "9902")

        ra = admin.post(f"{API}/route-configs", json={
            "number": "TEST_N1_A", "driver_id": a["id"], "dock": 1,
        }, timeout=TIMEOUT)
        assert ra.status_code == 200, ra.text[:300]
        created_ids.append(ra.json()["id"])

        rb = admin.post(f"{API}/route-configs", json={
            "number": "TEST_N1_B", "driver_id": b["id"], "dock": 2,
        }, timeout=TIMEOUT)
        assert rb.status_code == 200, rb.text[:300]
        created_ids.append(rb.json()["id"])

        rc = admin.post(f"{API}/route-configs", json={"number": "TEST_N1_C"}, timeout=TIMEOUT)
        assert rc.status_code == 200
        created_ids.append(rc.json()["id"])

        lst = admin.get(f"{API}/route-configs", timeout=TIMEOUT)
        assert lst.status_code == 200
        by_num = {x["number"]: x for x in lst.json() if x["number"].startswith("TEST_N1_")}
        assert set(by_num) == {"TEST_N1_A", "TEST_N1_B", "TEST_N1_C"}

        # Route A: driver is user 9901, not 9902
        da = by_num["TEST_N1_A"]["driver"]
        assert da is not None
        assert da["id"] == a["id"]
        assert da["username"] == "9901"
        assert da["nombres"] == a.get("nombres", "")
        assert da["apellidos"] == a.get("apellidos", "")

        # Route B: driver is user 9902, isolated from A
        dbb = by_num["TEST_N1_B"]["driver"]
        assert dbb is not None
        assert dbb["id"] == b["id"]
        assert dbb["username"] == "9902"
        assert dbb["id"] != da["id"]

        # Route C: no driver assigned -> driver must be null
        assert by_num["TEST_N1_C"]["driver"] is None
        assert by_num["TEST_N1_C"]["driver_id"] is None

        # All list docs must strip heavy arrays and be free of ObjectId
        for x in lst.json():
            assert "_id" not in x
            assert "stops" not in x, "list must not include heavy 'stops'"
            assert "sim_stops" not in x, "list must not include heavy 'sim_stops'"
            assert "stops_count" in x and isinstance(x["stops_count"], int)
            assert "driver" in x  # explicit key present (may be None)

    def test_get_single_returns_full_doc_and_enriched_driver(self, admin, drivers, created_ids):
        d = _free_driver(admin, drivers, "9901")
        r = admin.post(f"{API}/route-configs", json={
            "number": "TEST_N1_FULL", "driver_id": d["id"],
        }, timeout=TIMEOUT)
        assert r.status_code == 200
        cid = r.json()["id"]
        created_ids.append(cid)

        # Upload stops so the doc has heavy arrays
        with open(XLSX, "rb") as f:
            up = admin.post(
                f"{API}/route-configs/{cid}/stops",
                files={"file": ("s.xlsx", f,
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                timeout=300,
            )
        assert up.status_code == 200, up.text[:300]
        n = up.json()["stops_count"]
        assert n > 0

        # Single GET returns stops + enriched driver
        g = admin.get(f"{API}/route-configs/{cid}", timeout=TIMEOUT).json()
        assert g["stops_count"] == n
        assert isinstance(g.get("stops"), list) and len(g["stops"]) == n
        assert g["driver"] and g["driver"]["id"] == d["id"] and g["driver"]["username"] == "9901"

        # LIST for the same route: driver enriched, but no stops array
        lst = admin.get(f"{API}/route-configs", timeout=TIMEOUT).json()
        row = [x for x in lst if x["id"] == cid][0]
        assert row["stops_count"] == n
        assert "stops" not in row
        assert row["driver"] and row["driver"]["username"] == "9901"

    def test_simulation_summary_kept_in_list_no_sim_stops(self, admin, drivers, created_ids):
        d = _free_driver(admin, drivers, "9902")
        r = admin.post(f"{API}/route-configs", json={
            "number": "TEST_N1_SIM", "driver_id": d["id"],
        }, timeout=TIMEOUT)
        cid = r.json()["id"]
        created_ids.append(cid)

        with open(XLSX, "rb") as f:
            admin.post(f"{API}/route-configs/{cid}/stops",
                       files={"file": ("s.xlsx", f)}, timeout=300)

        # Save a minimal simulation payload
        sim_payload = {
            "stops": [
                {"id": "s1", "name": "A", "address": "A", "lat": 41.37, "lon": 2.12},
                {"id": "s2", "name": "B", "address": "B", "lat": 41.38, "lon": 2.13},
            ],
            "summary": {"distance_km": 1.23, "duration_min": 5.6, "stops": 2},
        }
        sv = admin.post(f"{API}/route-configs/{cid}/simulation", json=sim_payload, timeout=TIMEOUT)
        assert sv.status_code == 200, sv.text[:300]

        lst = admin.get(f"{API}/route-configs", timeout=TIMEOUT).json()
        row = [x for x in lst if x["id"] == cid][0]
        assert "sim_stops" not in row, "list must strip heavy sim_stops"
        assert "stops" not in row
        # sim_summary should be preserved on list
        assert row.get("sim_summary"), f"sim_summary missing in list row: {row}"
        assert row["sim_summary"].get("stops") == 2
        # driver still correctly enriched
        assert row["driver"]["username"] == "9902"

        # Single GET still returns sim_stops
        g = admin.get(f"{API}/route-configs/{cid}", timeout=TIMEOUT).json()
        assert isinstance(g.get("sim_stops"), list) and len(g["sim_stops"]) == 2

    def test_list_latency_is_reasonable(self, admin):
        """Sanity check that list endpoint responds fast (no per-doc DB round-trips)."""
        t0 = time.perf_counter()
        r = admin.get(f"{API}/route-configs", timeout=TIMEOUT)
        dt = time.perf_counter() - t0
        assert r.status_code == 200
        # Loose bound: should be well under 3s even with a handful of routes
        assert dt < 3.0, f"list latency too high: {dt:.2f}s"
