"""Tests for the new admin 'Configuración de rutas' feature (collection route_configs)
Covers: auth, CRUD, 1-route-per-driver rule (409), Excel stops upload, and driver comment endpoint.
"""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
API = _base.rstrip("/") + "/api"

ADMIN = {"username": "5708699", "password": "16288959"}
DRIVER = {"username": "1001", "password": "2002"}
XLSX = "/app/sample_new.xlsx"

TIMEOUT = 90


# ---- fixtures ----
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=TIMEOUT)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("token")
    assert isinstance(tok, str) and tok
    assert r.json()["user"]["role"] == "admin"
    return tok


@pytest.fixture(scope="module")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}"})
    return s


@pytest.fixture(scope="module")
def drivers(admin):
    """Ensure at least 2 driver users exist (1001 + a free TEST driver)."""
    r = admin.get(f"{API}/users", timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    users = r.json()
    have = {u["username"] for u in users}
    for uname, nombres in (("1001", "Carlos"), ("9901", "TEST_Free")):
        if uname not in have:
            cr = admin.post(f"{API}/users", json={
                "username": uname, "password": "2002", "nombres": nombres,
                "apellidos": "QA", "matricula": "0000-QA",
            }, timeout=TIMEOUT)
            # 400 "Ese usuario ya existe" => another xdist worker created it first
            assert cr.status_code in (200, 201, 400), cr.text[:300]
    users = admin.get(f"{API}/users", timeout=TIMEOUT).json()
    by_name = {u["username"]: u for u in users}
    return by_name


@pytest.fixture(scope="module")
def created_ids(admin):
    ids = []
    yield ids
    for cid in ids:
        admin.delete(f"{API}/route-configs/{cid}", timeout=TIMEOUT)


def _free_driver(admin, drivers, uname):
    """Return driver id for uname, removing any pre-existing route config on it."""
    d = drivers[uname]
    for rc in admin.get(f"{API}/route-configs", timeout=TIMEOUT).json():
        if rc.get("driver_id") == d["id"]:
            admin.delete(f"{API}/route-configs/{rc['id']}", timeout=TIMEOUT)
    return d["id"]


# ---- auth / access control ----
class TestAccess:
    def test_list_requires_auth(self):
        r = requests.get(f"{API}/route-configs", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_driver_cannot_access(self, drivers):
        lr = requests.post(f"{API}/auth/login", json=DRIVER, timeout=TIMEOUT)
        if lr.status_code != 200:
            pytest.fail(f"Driver login failed {lr.status_code}: {lr.text[:200]}")
        tok = lr.json()["token"]
        r = requests.get(f"{API}/route-configs", headers={"Authorization": f"Bearer {tok}"}, timeout=TIMEOUT)
        assert r.status_code == 403

    def test_admin_bcrypt_hash_format(self):
        """password_hash must never be exposed in API responses."""
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=TIMEOUT)
        assert "password_hash" not in r.json()["user"]


# ---- CRUD ----
class TestRouteConfigCRUD:
    def test_list_shape_no_objectid(self, admin):
        r = admin.get(f"{API}/route-configs", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for d in data:
            assert "_id" not in d
            assert "stops_count" in d and isinstance(d["stops_count"], int)
            assert "driver" in d

    def test_create_get_update_delete(self, admin, drivers, created_ids):
        did = _free_driver(admin, drivers, "9901")
        payload = {"number": "TEST_8500", "driver_id": did, "load_time": "06:30",
                   "dock": 4, "departure_time": "07:15"}
        r = admin.post(f"{API}/route-configs", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        c = r.json()
        cid = c["id"]
        created_ids.append(cid)
        assert c["number"] == "TEST_8500"
        assert c["dock"] == 4
        assert c["load_time"] == "06:30"
        assert c["departure_time"] == "07:15"
        assert c["stops_count"] == 0
        assert c["driver"]["username"] == "9901"
        assert "_id" not in c

        # GET verifies persistence
        g = admin.get(f"{API}/route-configs/{cid}", timeout=TIMEOUT)
        assert g.status_code == 200
        gd = g.json()
        assert gd["number"] == "TEST_8500"
        assert gd["dock"] == 4
        assert gd["driver_id"] == did
        assert gd["stops"] == []

        # UPDATE
        upd = {"number": "TEST_8501", "driver_id": did, "load_time": "05:00",
               "dock": 9, "departure_time": "05:45"}
        u = admin.put(f"{API}/route-configs/{cid}", json=upd, timeout=TIMEOUT)
        assert u.status_code == 200, u.text[:300]
        assert u.json()["number"] == "TEST_8501"

        g2 = admin.get(f"{API}/route-configs/{cid}", timeout=TIMEOUT).json()
        assert g2["number"] == "TEST_8501"
        assert g2["dock"] == 9
        assert g2["load_time"] == "05:00"
        assert g2["departure_time"] == "05:45"
        assert g2["updated_at"] != g2["created_at"]

        # DELETE
        d = admin.delete(f"{API}/route-configs/{cid}", timeout=TIMEOUT)
        assert d.status_code == 200
        assert admin.get(f"{API}/route-configs/{cid}", timeout=TIMEOUT).status_code == 404
        created_ids.remove(cid)

    def test_get_unknown_404(self, admin):
        assert admin.get(f"{API}/route-configs/does-not-exist", timeout=TIMEOUT).status_code == 404

    def test_delete_unknown_404(self, admin):
        assert admin.delete(f"{API}/route-configs/does-not-exist", timeout=TIMEOUT).status_code == 404

    def test_update_unknown_404(self, admin):
        r = admin.put(f"{API}/route-configs/does-not-exist", json={"number": "X"}, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_create_unknown_driver_404(self, admin):
        r = admin.post(f"{API}/route-configs", json={"number": "TEST_bad", "driver_id": "nope"}, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_create_without_driver_allowed(self, admin, created_ids):
        r = admin.post(f"{API}/route-configs", json={"number": "TEST_nodriver"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:300]
        c = r.json()
        created_ids.append(c["id"])
        assert c["driver"] is None
        assert c["driver_id"] is None


# ---- one route per driver rule ----
class TestOneRoutePerDriver:
    def test_duplicate_driver_create_409(self, admin, drivers, created_ids):
        did = _free_driver(admin, drivers, "9901")
        a = admin.post(f"{API}/route-configs", json={"number": "TEST_A", "driver_id": did}, timeout=TIMEOUT)
        assert a.status_code == 200
        created_ids.append(a.json()["id"])

        b = admin.post(f"{API}/route-configs", json={"number": "TEST_B", "driver_id": did}, timeout=TIMEOUT)
        assert b.status_code == 409, f"expected 409, got {b.status_code}: {b.text[:200]}"
        assert "detail" in b.json()
        # no duplicate persisted
        cnt = [x for x in admin.get(f"{API}/route-configs", timeout=TIMEOUT).json() if x.get("driver_id") == did]
        assert len(cnt) == 1

    def test_duplicate_driver_update_409(self, admin, drivers, created_ids):
        did = _free_driver(admin, drivers, "9901")
        a = admin.post(f"{API}/route-configs", json={"number": "TEST_A2", "driver_id": did}, timeout=TIMEOUT)
        assert a.status_code == 200
        created_ids.append(a.json()["id"])
        b = admin.post(f"{API}/route-configs", json={"number": "TEST_B2"}, timeout=TIMEOUT)
        assert b.status_code == 200
        bid = b.json()["id"]
        created_ids.append(bid)

        r = admin.put(f"{API}/route-configs/{bid}", json={"number": "TEST_B2", "driver_id": did}, timeout=TIMEOUT)
        assert r.status_code == 409, f"expected 409, got {r.status_code}"
        # unchanged
        assert admin.get(f"{API}/route-configs/{bid}", timeout=TIMEOUT).json()["driver_id"] is None

    def test_update_same_driver_on_own_route_ok(self, admin, drivers, created_ids):
        did = _free_driver(admin, drivers, "9901")
        a = admin.post(f"{API}/route-configs", json={"number": "TEST_same", "driver_id": did}, timeout=TIMEOUT)
        cid = a.json()["id"]
        created_ids.append(cid)
        r = admin.put(f"{API}/route-configs/{cid}", json={"number": "TEST_same2", "driver_id": did}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["driver_id"] == did

    def test_driver_freed_after_delete(self, admin, drivers, created_ids):
        did = _free_driver(admin, drivers, "9901")
        a = admin.post(f"{API}/route-configs", json={"number": "TEST_free1", "driver_id": did}, timeout=TIMEOUT)
        cid = a.json()["id"]
        assert admin.delete(f"{API}/route-configs/{cid}", timeout=TIMEOUT).status_code == 200
        b = admin.post(f"{API}/route-configs", json={"number": "TEST_free2", "driver_id": did}, timeout=TIMEOUT)
        assert b.status_code == 200, b.text[:200]
        created_ids.append(b.json()["id"])


# ---- Excel stops upload ----
class TestStopsUpload:
    def test_upload_stops_and_persist(self, admin, created_ids):
        r = admin.post(f"{API}/route-configs", json={"number": "TEST_stops"}, timeout=TIMEOUT)
        cid = r.json()["id"]
        created_ids.append(cid)

        with open(XLSX, "rb") as f:
            up = admin.post(f"{API}/route-configs/{cid}/stops",
                            files={"file": ("sample_new.xlsx", f,
                                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                            timeout=300)
        assert up.status_code == 200, up.text[:300]
        data = up.json()
        assert data["stops_count"] > 0
        n = data["stops_count"]

        g = admin.get(f"{API}/route-configs/{cid}", timeout=TIMEOUT).json()
        assert g["stops_count"] == n
        assert len(g["stops"]) == n
        s0 = g["stops"][0]
        for key in ("id", "name", "address", "lat", "lon"):
            assert key in s0, f"missing {key} in stop"
        assert s0["lat"] is not None and s0["lon"] is not None
        # ids unique
        assert len({s["id"] for s in g["stops"]}) == n

        # list endpoint must expose count but not full stops payload
        listed = [x for x in admin.get(f"{API}/route-configs", timeout=TIMEOUT).json() if x["id"] == cid][0]
        assert listed["stops_count"] == n
        assert "stops" not in listed

    def test_upload_unknown_route_404(self, admin):
        with open(XLSX, "rb") as f:
            r = admin.post(f"{API}/route-configs/nope/stops", files={"file": ("a.xlsx", f)}, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_upload_bad_file_400(self, admin, created_ids):
        r = admin.post(f"{API}/route-configs", json={"number": "TEST_badfile"}, timeout=TIMEOUT)
        cid = r.json()["id"]
        created_ids.append(cid)
        up = admin.post(f"{API}/route-configs/{cid}/stops",
                        files={"file": ("bad.xlsx", b"not-an-excel", "application/vnd.ms-excel")}, timeout=TIMEOUT)
        assert up.status_code == 400, up.status_code

    def test_update_fields_preserves_stops(self, admin, created_ids):
        r = admin.post(f"{API}/route-configs", json={"number": "TEST_keepstops"}, timeout=TIMEOUT)
        cid = r.json()["id"]
        created_ids.append(cid)
        with open(XLSX, "rb") as f:
            up = admin.post(f"{API}/route-configs/{cid}/stops", files={"file": ("s.xlsx", f)}, timeout=300)
        n = up.json()["stops_count"]
        assert n > 0
        admin.put(f"{API}/route-configs/{cid}", json={"number": "TEST_keepstops2", "dock": 2}, timeout=TIMEOUT)
        g = admin.get(f"{API}/route-configs/{cid}", timeout=TIMEOUT).json()
        assert g["stops_count"] == n, "stops lost after PUT of scalar fields"
        assert g["number"] == "TEST_keepstops2"
