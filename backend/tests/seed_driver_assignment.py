"""Seed helper: creates TODAY's assignment for driver 1001 so the driver UI flow can be tested."""
import os
from datetime import datetime, timezone

import requests
from dotenv import dotenv_values

API = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/") + "/api"

tok = requests.post(f"{API}/auth/login", json={"username": "5708699", "password": "16288959"}, timeout=60).json()["token"]
H = {"Authorization": f"Bearer {tok}"}
users = requests.get(f"{API}/users", headers=H, timeout=60).json()
drv = [u for u in users if u["username"] == "1001"][0]

stops = [
    {"id": "seed-1", "name": "TEST_Parada Uno", "address": "Carrer Progres 49, L'Hospitalet", "lat": 41.36948, "lon": 2.12353, "window_from": "08:00", "window_to": "14:00"},
    {"id": "seed-2", "name": "TEST_Parada Dos", "address": "Avinguda Carrilet 10, L'Hospitalet", "lat": 41.372095, "lon": 2.124075, "window_from": "09:00", "window_to": "18:00"},
    {"id": "seed-3", "name": "TEST_Parada Tres", "address": "Carrer Llobregat 138, L'Hospitalet", "lat": 41.373689, "lon": 2.122336},
]
body = {
    "driver_id": drv["id"],
    "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    "name": "TEST_Ruta Conductor",
    "stops": stops,
    "metric": "duration",
    "round_trip": False,
}
r = requests.post(f"{API}/assignments", headers=H, json=body, timeout=60)
print(r.status_code, str(r.json())[:200])
