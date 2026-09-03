"""Round-3 backend tests: per-type service minutes, stop types, geocode resolution, export columns."""
import io

import pytest
import pandas as pd

from conftest import API


# ---------------------- import-excel: geocode resolution ----------------------
@pytest.fixture(scope="module")
def geo_import(api_client):
    with open("/app/sample_geo_test.xlsx", "rb") as f:
        r = api_client.post(
            f"{API}/import-excel",
            files={"file": ("sample_geo_test.xlsx", f.read(),
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=120,
        )
    assert r.status_code == 200, r.text
    return r.json()


class TestImportGeoTest:
    def test_counts(self, geo_import):
        d = geo_import
        assert d["total"] == 3
        assert d["resolved_count"] == 1, d
        assert d["pending_count"] == 2, d
        assert d["untyped_count"] == 0, d

    def test_reasons_and_candidates(self, geo_import):
        reasons = {p["reason"] for p in geo_import["pending"]}
        assert "not_found" in reasons, reasons
        assert reasons & {"far_apart", "multiple"}, reasons
        for p in geo_import["pending"]:
            if p["reason"] == "not_found":
                assert p["candidates"] == []
            else:
                assert len(p["candidates"]) > 1
                for c in p["candidates"]:
                    assert isinstance(c["lat"], float) and isinstance(c["lon"], float)
                    assert c["display_name"]

    def test_stop_type_present(self, geo_import):
        for s in geo_import["resolved"] + geo_import["pending"]:
            assert "stop_type" in s
        assert geo_import["resolved"][0]["stop_type"] in ("L", "P", "PD")

    def test_no_mongo_id(self, geo_import):
        for s in geo_import["resolved"] + geo_import["pending"]:
            assert "_id" not in s


# ---------------------- import-excel: old format (untyped) ----------------------
class TestImportOldFormat:
    def test_all_untyped_and_resolved(self, api_client):
        with open("/app/sample_stops.xlsx", "rb") as f:
            r = api_client.post(
                f"{API}/import-excel",
                files={"file": ("sample_stops.xlsx", f.read(),
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                timeout=120,
            )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["resolved_count"] == 36, d["resolved_count"]
        assert d["pending_count"] == 0
        assert d["untyped_count"] == 36
        assert all(s["stop_type"] is None for s in d["resolved"])


# ---------------------- settings: service_by_type ----------------------
class TestSettingsByType:
    def test_put_and_get_service_by_type(self, api_client):
        body = {
            "start": None, "end": None, "same_as_start": True,
            "service_time_min": 5,
            "service_by_type": {"P": 3, "PD": 4, "L": 6},
        }
        r = api_client.put(f"{API}/settings", json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["service_by_type"] == {"P": 3, "PD": 4, "L": 6}
        assert d["service_time_min"] == 5

        g = api_client.get(f"{API}/settings", timeout=30)
        assert g.status_code == 200
        gd = g.json()
        assert gd["service_by_type"] == {"P": 3, "PD": 4, "L": 6}
        assert gd["service_time_min"] == 5
        assert "_id" not in gd


# ---------------------- optimize / route: per-stop service sum ----------------------
def _typed_stops(sample_stops):
    mins = [3, 4, 6]
    types = ["P", "PD", "L"]
    out = []
    for i, s in enumerate(sample_stops[:3]):
        st = dict(s)
        st["stop_type"] = types[i]
        st["service_min"] = mins[i]
        out.append(st)
    return out


class TestPerStopService:
    def test_optimize_sums_service_min(self, api_client, sample_stops):
        stops = _typed_stops(sample_stops)
        r = api_client.post(f"{API}/optimize", json={
            "stops": stops, "metric": "duration", "round_trip": True, "service_time_min": 99,
        }, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        s = d["summary"]
        assert s["service_duration"] == (3 + 4 + 6) * 60, s
        assert abs(s["duration"] - (s["drive_duration"] + s["service_duration"])) < 1e-6
        assert isinstance(d["legs"], list) and len(d["legs"]) >= 1
        assert len(d["order"]) == 3

    def test_route_sums_service_min(self, api_client, sample_stops):
        stops = _typed_stops(sample_stops)
        r = api_client.post(f"{API}/route", json={
            "stops": stops, "round_trip": True, "service_time_min": 99,
        }, timeout=60)
        assert r.status_code == 200, r.text
        s = r.json()["summary"]
        assert s["service_duration"] == 13 * 60
        assert abs(s["duration"] - (s["drive_duration"] + s["service_duration"])) < 1e-6
        assert isinstance(r.json()["legs"], list)

    def test_route_falls_back_to_uniform_when_no_service_min(self, api_client, sample_stops):
        stops = [dict(s) for s in sample_stops[:3]]
        r = api_client.post(f"{API}/route", json={
            "stops": stops, "round_trip": True, "service_time_min": 5,
        }, timeout=60)
        assert r.status_code == 200, r.text
        s = r.json()["summary"]
        assert s["service_duration"] == 5 * 60 * 3, s

    def test_zero_service_min_stops(self, api_client, sample_stops):
        stops = [dict(s) for s in sample_stops[:3]]
        for st in stops:
            st["service_min"] = 0
        r = api_client.post(f"{API}/route", json={
            "stops": stops, "round_trip": True, "service_time_min": 7,
        }, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json()["summary"]["service_duration"] == 0


# ---------------------- export columns ----------------------
class TestExportColumns:
    def test_export_has_tipo_and_min(self, api_client, sample_stops):
        stops = _typed_stops(sample_stops)
        r = api_client.post(f"{API}/export", json={"stops": stops, "round_trip": True}, timeout=60)
        assert r.status_code == 200, r.text
        assert "spreadsheetml" in r.headers.get("content-type", "")
        df = pd.read_excel(io.BytesIO(r.content))
        assert "Tipo" in df.columns
        assert "Min. parada" in df.columns
        labels = list(df["Tipo"])
        assert labels == ["Particular", "PUDO", "Locker"], labels
        assert list(df["Min. parada"]) == [3, 4, 6]
