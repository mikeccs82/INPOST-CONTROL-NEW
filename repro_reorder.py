import os, asyncio, uuid, httpx
from datetime import datetime, timezone
from pymongo import MongoClient

BASE = "http://localhost:8001/api"
ADMIN_USER = "5708699"
ADMIN_PASS = "16288959"

c = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = c[os.environ.get("DB_NAME", "test_database")]
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")


def cleanup():
    db.users.delete_many({"username": "repro_driver"})
    db.route_configs.delete_many({"number": "REPRO"})
    db.saca_day_sessions.delete_many({"date": TODAY, "route_config_id": {"$regex": ""}})
    db.route_journal.delete_many({"route_number": "REPRO"})


def main():
    with httpx.Client(timeout=30) as h:
        # admin login
        r = h.post(f"{BASE}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        print("admin login", r.status_code)
        atok = r.json()["token"]
        ah = {"Authorization": f"Bearer {atok}"}

        # create driver
        h.post(f"{BASE}/users", headers=ah, json={"username": "repro_driver", "password": "1234", "is_admin": False, "nombres": "Repro", "apellidos": "Driver", "capacidad": "100"})
        drv = db.users.find_one({"username": "repro_driver"})
        did = drv["id"]
        print("driver id", did)

        # create route config
        r = h.post(f"{BASE}/route-configs", headers=ah, json={"number": "REPRO", "driver_ids": [did]})
        cfg = r.json()
        cid = cfg["id"]
        print("config", cid, r.status_code)

        # inject 4 stops directly
        stops = []
        coords = [(41.224, 1.725), (41.230, 1.730), (41.215, 1.720), (41.240, 1.740)]
        for i, (la, lo) in enumerate(coords):
            stops.append({"id": str(uuid.uuid4()), "name": f"Parada {i+1}", "address": f"Calle {i+1}", "lat": la, "lon": lo, "stop_type": "P"})
        db.route_configs.update_one({"id": cid}, {"$set": {"stops": stops}})

        # journal entry (gating) for today
        db.route_journal.insert_one({"id": str(uuid.uuid4()), "date": TODAY, "route_config_id": cid, "route_number": "REPRO", "driver_id": did, "created_at": datetime.now(timezone.utc).isoformat()})

        # saca session ordering all stops
        positions = [{"stop_id": s["id"], "floor": 1, "index": i} for i, s in enumerate(stops)]
        db.saca_day_sessions.insert_one({"driver_id": did, "date": TODAY, "route_config_id": cid, "positions": positions, "isolated": []})

        # driver login
        r = h.post(f"{BASE}/auth/login", json={"username": "repro_driver", "password": "1234"})
        dtok = r.json()["token"]
        dh = {"Authorization": f"Bearer {dtok}"}

        # build route
        r = h.post(f"{BASE}/my/route/build", headers=dh)
        print("build", r.status_code, r.text[:200])
        built = r.json()["driver_route"]["stops"]
        order_before = [s["name"] for s in built]
        print("ORDER AFTER BUILD:", order_before)

        # reorder: move first stop to last
        reordered = built[1:] + [built[0]]
        payload = {"date": TODAY, "stops": reordered}
        r = h.put(f"{BASE}/my/driver-route/order", headers=dh, json=payload)
        print("reorder PUT", r.status_code, r.text[:300])

        # reload route-config
        r = h.get(f"{BASE}/my/route-config", headers=dh)
        after = [s["name"] for s in r.json()["driver_route"]["stops"]]
        print("ORDER SENT:    ", [s["name"] for s in reordered])
        print("ORDER RELOADED:", after)
        print("PERSISTED?", after == [s["name"] for s in reordered])


if __name__ == "__main__":
    cleanup()
    main()
