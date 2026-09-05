import os
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

NAVE = {"id": "nave", "name": "Nave Vilanova i la Geltrú", "address": "Carrer de les Oliveres, 1, 08800 Vilanova i la Geltrú, Barcelona", "lat": 41.2462526, "lon": 1.722634}

user = db.users.find_one({"username": "1122"})
assert user, "driver 1122 not found"
did = user["id"]
rc = db.route_configs.find_one({"driver_id": did})
assert rc, "route_config not found"
stops = [s for s in rc.get("stops", []) if s.get("lat") is not None][:5]
assert len(stops) >= 4, f"not enough geocoded stops: {len(stops)}"
now = datetime.now(timezone.utc).isoformat()


def seed_day(date, subset, reparto_progress):
    # saca_day_sessions
    positions = [{"position": i + 1, "last4": (s.get("order_id") or "0000")[-4:], "stop_id": s["id"],
                  "stop_name": s.get("name", ""), "sacas": 2, "bultos": 1} for i, s in enumerate(subset)]
    db.saca_day_sessions.update_one({"driver_id": did, "date": date}, {"$set": {
        "driver_id": did, "date": date, "route_config_id": rc["id"], "positions": positions, "isolated": [], "updated_at": now}}, upsert=True)
    # route_day_sessions
    dr = {"stops": subset, "start": NAVE, "end": None, "round_trip": True, "departure_time": "08:00",
          "summary": {"distance": 12000, "duration": 3600}, "updated_at": now}
    db.route_day_sessions.update_one({"driver_id": did, "date": date}, {"$set": {
        "driver_id": did, "date": date, "route_config_id": rc["id"], "route_number": rc.get("number"),
        "driver_route": dr, "updated_at": now}}, upsert=True)
    # carga_sessions (todas cargadas)
    db.carga_sessions.update_one({"driver_id": did, "date": date}, {"$set": {
        "driver_id": did, "date": date, "route_config_id": rc["id"], "route_number": rc.get("number"),
        "loaded_stop_ids": [s["id"] for s in subset], "updated_at": now}}, upsert=True)
    # reparto_sessions
    db.reparto_sessions.update_one({"driver_id": did, "date": date}, {"$set": {
        "driver_id": did, "date": date, "route_config_id": rc["id"], "route_number": rc.get("number"),
        "idx": reparto_progress["idx"], "stops": reparto_progress["stops"], "updated_at": now}}, upsert=True)
    print(f"Seeded {date}: {len(subset)} paradas")


# Día 1: 2026-09-03 -> completado (todas hechas)
subset1 = stops[:4]
prog1 = {"idx": len(subset1), "stops": {}}
for s in subset1:
    prog1["stops"][s["id"]] = {"delivered": True, "deliveredSacas": 2, "deliveredBultos": 1,
                                "pickedUp": True, "pickupSacas": 1, "done": True}
seed_day("2026-09-03", subset1, prog1)

# Día 2: 2026-09-04 -> con incidencias (una vuelvo, una cerrado definitivo, resto hechas)
subset2 = stops[:4]
prog2 = {"idx": len(subset2), "stops": {}}
prog2["stops"][subset2[0]["id"]] = {"delivered": True, "deliveredSacas": 3, "deliveredBultos": 0, "pickedUp": True, "pickupSacas": 2, "done": True}
prog2["stops"][subset2[1]["id"]] = {"incidencia": {"tipo": "vuelvo", "detalle": "Cerrado, vuelvo más tarde"}, "done": False}
prog2["stops"][subset2[2]["id"]] = {"incidencia": {"tipo": "definitivo", "detalle": "Local cerrado permanentemente"}, "done": True}
prog2["stops"][subset2[3]["id"]] = {"delivered": True, "deliveredSacas": 1, "deliveredBultos": 1, "pickedUp": True, "pickupSacas": 0, "done": True, "incidencia": {"tipo": "general", "detalle": "Faltaba una saca en la entrega"}}
seed_day("2026-09-04", subset2, prog2)

print("Listo. Días disponibles:", sorted({d["date"] for d in db.saca_day_sessions.find({"driver_id": did}, {"date": 1})}, reverse=True))
