from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import math
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime, timezone
import httpx
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

NOMINATIM = "https://nominatim.openstreetmap.org"
OSRM = "https://router.project-osrm.org"
UA = "RouteOptimizer/1.0 (logistics dispatcher tool)"

logger = logging.getLogger("route_optimizer")
logging.basicConfig(level=logging.INFO)


# ----------------------------- Models -----------------------------
class Stop(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    address: str = ""
    lat: float
    lon: float
    order_id: Optional[str] = None
    window_from: Optional[str] = None
    window_to: Optional[str] = None
    notes: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class OptimizeRequest(BaseModel):
    stops: List[Stop]
    depot_index: int = 0
    metric: str = "duration"  # 'duration' (fastest) or 'distance' (shortest)
    round_trip: bool = True


class RouteRequest(BaseModel):
    stops: List[Stop]  # already ordered


class SavedRouteCreate(BaseModel):
    name: str
    stops: List[Stop]
    metric: str = "duration"
    round_trip: bool = True
    depot_index: int = 0


class SavedRoute(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    stops: List[Dict[str, Any]]
    metric: str = "duration"
    round_trip: bool = True
    depot_index: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# --------------------------- Helpers ------------------------------
def _coords_str(stops: List[Stop]) -> str:
    return ";".join(f"{s.lon},{s.lat}" for s in stops)


async def osrm_table(stops: List[Stop]):
    coords = _coords_str(stops)
    url = f"{OSRM}/table/v1/driving/{coords}?annotations=duration,distance"
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": UA}) as c:
        r = await c.get(url)
        r.raise_for_status()
        data = r.json()
    if data.get("code") != "Ok":
        raise HTTPException(502, f"OSRM table error: {data.get('code')}")
    return data["durations"], data["distances"]


async def osrm_route(stops: List[Stop]):
    coords = _coords_str(stops)
    url = f"{OSRM}/route/v1/driving/{coords}?overview=full&geometries=geojson"
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": UA}) as c:
        r = await c.get(url)
        r.raise_for_status()
        data = r.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise HTTPException(502, f"OSRM route error: {data.get('code')}")
    route = data["routes"][0]
    return {
        "geometry": route["geometry"]["coordinates"],  # [lon,lat] pairs
        "distance": route["distance"],  # meters
        "duration": route["duration"],  # seconds
    }


def nearest_neighbor(matrix, start, n):
    unvisited = set(range(n))
    unvisited.discard(start)
    order = [start]
    cur = start
    while unvisited:
        nxt = min(unvisited, key=lambda j: matrix[cur][j] if matrix[cur][j] is not None else math.inf)
        order.append(nxt)
        unvisited.discard(nxt)
        cur = nxt
    return order


def route_cost(order, matrix, round_trip):
    total = 0.0
    for i in range(len(order) - 1):
        v = matrix[order[i]][order[i + 1]]
        total += v if v is not None else 1e9
    if round_trip and len(order) > 1:
        v = matrix[order[-1]][order[0]]
        total += v if v is not None else 1e9
    return total


def two_opt(order, matrix, round_trip):
    # Keep first node (depot) fixed
    best = order[:]
    best_cost = route_cost(best, matrix, round_trip)
    improved = True
    while improved:
        improved = False
        for i in range(1, len(best) - 1):
            for k in range(i + 1, len(best)):
                new_order = best[:i] + best[i:k + 1][::-1] + best[k + 1:]
                c = route_cost(new_order, matrix, round_trip)
                if c + 1e-6 < best_cost:
                    best, best_cost = new_order, c
                    improved = True
    return best


def or_opt(order, matrix, round_trip):
    # Move segments of length 1..3 to a better position (depot stays first)
    best = order[:]
    best_cost = route_cost(best, matrix, round_trip)
    improved = True
    while improved:
        improved = False
        for seg in (1, 2, 3):
            for i in range(1, len(best) - seg + 1):
                segment = best[i:i + seg]
                rest = best[:i] + best[i + seg:]
                for j in range(1, len(rest) + 1):
                    if j == i:
                        continue
                    cand = rest[:j] + segment + rest[j:]
                    c = route_cost(cand, matrix, round_trip)
                    if c + 1e-6 < best_cost:
                        best, best_cost = cand, c
                        improved = True
    return best


def solve(matrix, depot, n, round_trip):
    order = nearest_neighbor(matrix, depot, n)
    order = two_opt(order, matrix, round_trip)
    order = or_opt(order, matrix, round_trip)
    order = two_opt(order, matrix, round_trip)
    return order


# --------------------------- Routes -------------------------------
@api_router.get("/")
async def root():
    return {"message": "Route Optimizer API"}


@api_router.get("/geocode")
async def geocode(q: str, limit: int = 6):
    if not q or len(q.strip()) < 3:
        return []
    params = {"q": q, "format": "jsonv2", "limit": limit, "addressdetails": 1, "countrycodes": "es"}
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": UA}) as c:
        r = await c.get(f"{NOMINATIM}/search", params=params)
        r.raise_for_status()
        data = r.json()
    return [
        {
            "display_name": d.get("display_name"),
            "lat": float(d["lat"]),
            "lon": float(d["lon"]),
            "type": d.get("type"),
        }
        for d in data
    ]


async def _geocode_one(c: httpx.AsyncClient, address: str):
    try:
        r = await c.get(f"{NOMINATIM}/search", params={"q": address, "format": "jsonv2", "limit": 1, "countrycodes": "es"})
        r.raise_for_status()
        data = r.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        logger.warning(f"geocode fail for {address}: {e}")
    return None, None


@api_router.post("/import-excel")
async def import_excel(file: UploadFile = File(...)):
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"No se pudo leer el archivo: {e}")

    cols = {str(c).strip().lower(): c for c in df.columns}

    def pick(*names):
        for n in names:
            if n in cols:
                return cols[n]
        return None

    c_addr = pick("dirección", "direccion", "address")
    c_name = pick("nombre de ubicación", "nombre de ubicacion", "name", "nombre")
    c_lat = pick("latitud", "latitude", "lat")
    c_lon = pick("longitud", "longitude", "lon", "lng")
    c_id = pick("id de orden", "id de ubicación", "id de ubicacion", "order id", "id")
    c_wf = pick("ventana horaria desde", "window from")
    c_wt = pick("ventana horaria hasta", "window to")
    c_notes = pick("notas", "notes")
    c_phone = pick("número de teléfono", "numero de telefono", "phone")
    c_email = pick("email", "correo")

    stops = []
    to_geocode = []
    for _, row in df.iterrows():
        def val(col):
            if col is None:
                return None
            v = row[col]
            if pd.isna(v):
                return None
            return v

        lat = val(c_lat)
        lon = val(c_lon)
        addr = val(c_addr)
        name = val(c_name)
        if addr is None and lat is None:
            continue
        stop = {
            "id": str(uuid.uuid4()),
            "name": str(name) if name is not None else "",
            "address": str(addr) if addr is not None else "",
            "order_id": str(val(c_id)) if val(c_id) is not None else None,
            "window_from": str(val(c_wf)) if val(c_wf) is not None else None,
            "window_to": str(val(c_wt)) if val(c_wt) is not None else None,
            "notes": str(val(c_notes)) if val(c_notes) is not None else None,
            "phone": str(val(c_phone)) if val(c_phone) is not None else None,
            "email": str(val(c_email)) if val(c_email) is not None else None,
            "lat": float(lat) if lat is not None else None,
            "lon": float(lon) if lon is not None else None,
        }
        stops.append(stop)
        if stop["lat"] is None or stop["lon"] is None:
            if stop["address"]:
                to_geocode.append(stop)

    # Geocode missing addresses (respecting Nominatim ~1 req/s)
    geocoded = 0
    if to_geocode:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": UA}) as c:
            for idx, stop in enumerate(to_geocode):
                if idx > 0:
                    await asyncio.sleep(1.0)  # respect Nominatim ~1 req/s, only between requests
                lat, lon = await _geocode_one(c, stop["address"])
                if lat is not None:
                    stop["lat"] = lat
                    stop["lon"] = lon
                    geocoded += 1

    valid = [s for s in stops if s["lat"] is not None and s["lon"] is not None]
    skipped = len(stops) - len(valid)
    return {"stops": valid, "total": len(stops), "geocoded": geocoded, "skipped": skipped}


@api_router.post("/route")
async def compute_route(req: RouteRequest):
    if len(req.stops) < 2:
        raise HTTPException(400, "Se necesitan al menos 2 paradas")
    result = await osrm_route(req.stops)
    return {"order": [s.id for s in req.stops], "summary": {"distance": result["distance"], "duration": result["duration"]}, "geometry": result["geometry"]}


@api_router.post("/optimize")
async def optimize(req: OptimizeRequest):
    n = len(req.stops)
    if n < 2:
        raise HTTPException(400, "Se necesitan al menos 2 paradas para optimizar")

    durations, distances = await osrm_table(req.stops)
    matrix = distances if req.metric == "distance" else durations
    other = durations if req.metric == "distance" else distances

    depot = req.depot_index if 0 <= req.depot_index < n else 0
    # Solve for the chosen metric AND the other metric, then keep whichever
    # tour is best under the selected objective (guarantees 'fastest' is never
    # worse than 'shortest' and vice-versa).
    cand_main = solve(matrix, depot, n, req.round_trip)
    cand_other = solve(other, depot, n, req.round_trip)
    order = min([cand_main, cand_other], key=lambda o: route_cost(o, matrix, req.round_trip))

    ordered_stops = [req.stops[i] for i in order]
    if req.round_trip:
        ordered_stops = ordered_stops + [req.stops[order[0]]]

    result = await osrm_route(ordered_stops)
    # ordered stop ids without duplicate return marker
    stop_order = [req.stops[i].id for i in order]
    return {
        "order": stop_order,
        "round_trip": req.round_trip,
        "summary": {"distance": result["distance"], "duration": result["duration"], "stops": n},
        "geometry": result["geometry"],
    }


@api_router.post("/routes", response_model=SavedRoute)
async def save_route(body: SavedRouteCreate):
    doc = SavedRoute(name=body.name, stops=[s.model_dump() for s in body.stops], metric=body.metric, round_trip=body.round_trip, depot_index=body.depot_index)
    await db.routes.insert_one(doc.model_dump())
    return doc


@api_router.get("/routes", response_model=List[SavedRoute])
async def list_routes():
    docs = await db.routes.find({}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return docs


@api_router.get("/routes/{route_id}", response_model=SavedRoute)
async def get_route(route_id: str):
    doc = await db.routes.find_one({"id": route_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Ruta no encontrada")
    return doc


@api_router.put("/routes/{route_id}", response_model=SavedRoute)
async def update_route(route_id: str, body: SavedRouteCreate):
    existing = await db.routes.find_one({"id": route_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Ruta no encontrada")
    update = {
        "name": body.name,
        "stops": [s.model_dump() for s in body.stops],
        "metric": body.metric,
        "round_trip": body.round_trip,
        "depot_index": body.depot_index,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.routes.update_one({"id": route_id}, {"$set": update})
    doc = await db.routes.find_one({"id": route_id}, {"_id": 0})
    return doc


@api_router.delete("/routes/{route_id}")
async def delete_route(route_id: str):
    res = await db.routes.delete_one({"id": route_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Ruta no encontrada")
    return {"ok": True}


@api_router.post("/export")
async def export_route(req: RouteRequest):
    rows = []
    for i, s in enumerate(req.stops):
        rows.append({
            "Orden": i + 1,
            "ID": s.order_id or s.id,
            "Nombre": s.name,
            "Dirección": s.address,
            "Latitud": s.lat,
            "Longitud": s.lon,
            "Ventana desde": s.window_from or "",
            "Ventana hasta": s.window_to or "",
            "Teléfono": s.phone or "",
            "Notas": s.notes or "",
        })
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name="Ruta")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=ruta_optimizada.xlsx"},
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
