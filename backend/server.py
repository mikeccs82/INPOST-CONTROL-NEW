from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Depends, Header
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
from datetime import datetime, timezone, timedelta
import httpx
import pandas as pd
import bcrypt
import jwt

try:
    from ortools.constraint_solver import routing_enums_pb2, pywrapcp
    ORTOOLS = True
except Exception:
    ORTOOLS = False

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

NOMINATIM = "https://nominatim.openstreetmap.org"
OSRM = "https://router.project-osrm.org"
UA = "BoxLogic-RouteOptimizer/1.0 (logistics dispatcher; contact: support@boxlogic.app)"

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
    stop_type: Optional[str] = None  # 'P' particular, 'PD' pudo, 'L' locker
    service_min: Optional[float] = None  # minutes spent at this stop


class Waypoint(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    address: str = ""
    lat: float
    lon: float


class OptimizeRequest(BaseModel):
    stops: List[Stop]
    depot_index: int = 0
    metric: str = "duration"  # 'duration' (fastest) or 'distance' (shortest)
    round_trip: bool = True
    start: Optional[Waypoint] = None  # warehouse departure
    end: Optional[Waypoint] = None    # warehouse arrival (if different)
    service_time_min: float = 0       # minutes spent at each stop
    departure_time: Optional[str] = None  # HH:MM departure from warehouse
    respect_windows: bool = False     # order respecting time windows (VRPTW)


class RouteRequest(BaseModel):
    stops: List[Stop]  # already ordered
    start: Optional[Waypoint] = None
    end: Optional[Waypoint] = None
    round_trip: bool = True
    service_time_min: float = 0
    departure_time: Optional[str] = None


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    start: Optional[Waypoint] = None
    end: Optional[Waypoint] = None
    same_as_start: bool = True
    service_time_min: float = 0
    service_by_type: Dict[str, float] = Field(default_factory=lambda: {"P": 0, "PD": 0, "L": 0})
    departure_time: Optional[str] = None
    respect_windows: bool = True
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class DriverCreate(BaseModel):
    nombres: str
    apellidos: str = ""
    dni: str = ""
    telefono: str = ""
    marca: str = ""
    modelo: str = ""
    anio: str = ""
    tamano: str = ""
    matricula: str = ""


class Driver(DriverCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SavedRouteCreate(BaseModel):
    name: str
    stops: List[Stop]
    metric: str = "duration"
    round_trip: bool = True
    depot_index: int = 0
    start: Optional[Waypoint] = None
    end: Optional[Waypoint] = None
    service_time_min: float = 0


class SavedRoute(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    stops: List[Dict[str, Any]]
    metric: str = "duration"
    round_trip: bool = True
    depot_index: int = 0
    start: Optional[Dict[str, Any]] = None
    end: Optional[Dict[str, Any]] = None
    service_time_min: float = 0
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
    url = f"{OSRM}/route/v1/driving/{coords}?overview=full&geometries=geojson&steps=true"
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": UA}) as c:
        r = await c.get(url)
        r.raise_for_status()
        data = r.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise HTTPException(502, f"OSRM route error: {data.get('code')}")
    route = data["routes"][0]
    legs = []
    leg_durations = []
    for leg in route.get("legs", []):
        leg_durations.append(leg.get("duration", 0))
        coords_leg = []
        for step in leg.get("steps", []):
            g = step.get("geometry", {}).get("coordinates", [])
            if coords_leg and g and coords_leg[-1] == g[0]:
                coords_leg.extend(g[1:])
            else:
                coords_leg.extend(g)
        legs.append(coords_leg)
    return {
        "geometry": route["geometry"]["coordinates"],  # [lon,lat] pairs
        "distance": route["distance"],  # meters
        "duration": route["duration"],  # seconds
        "legs": legs,  # per-leg [lon,lat] coordinate arrays
        "leg_durations": leg_durations,  # per-leg seconds
    }


def _parse_hhmm(s):
    if s is None:
        return None
    t = str(s).strip()
    if not t or t.lower() in ("nan", "none", "nat"):
        return None
    parts = t.replace(".", ":").split(":")
    try:
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        return h * 3600 + m * 60
    except Exception:
        return None


def _fmt_hhmm(sec):
    if sec is None:
        return None
    sec = int(round(sec))
    h = (sec // 3600) % 24
    m = (sec % 3600) // 60
    return f"{h:02d}:{m:02d}"


def _compute_schedule(geo_nodes, leg_durations, departure_sec, stop_ids):
    sched = []
    seen = set()
    t = float(departure_sec)
    for i, node in enumerate(geo_nodes):
        if i > 0:
            t += leg_durations[i - 1] if (i - 1) < len(leg_durations) else 0
        nid = getattr(node, "id", None)
        if nid in stop_ids and nid not in seen:
            seen.add(nid)
            d = node.model_dump()
            wf = _parse_hhmm(d.get("window_from"))
            wt = _parse_hhmm(d.get("window_to"))
            arrival = t
            wait = 0
            if wf is not None and arrival < wf:
                wait = wf - arrival
                t = wf
            late = wt is not None and arrival > wt
            sched.append({
                "id": nid,
                "arrival": _fmt_hhmm(arrival),
                "arrival_sec": int(arrival),
                "wait_min": int(round(wait / 60)),
                "late": bool(late),
                "window_from": d.get("window_from"),
                "window_to": d.get("window_to"),
            })
            t += float(d.get("service_min") or 0) * 60
    return sched, t


def solve_vrptw(travel, service, windows, start, end, departure, penalty=30, time_limit=8):
    n = len(travel)
    ends = [end if end is not None else start]
    mgr = pywrapcp.RoutingIndexManager(n, 1, [start], ends)
    routing = pywrapcp.RoutingModel(mgr)
    T = [[int(round(travel[i][j])) if travel[i][j] is not None else 10 ** 8 for j in range(n)] for i in range(n)]
    S = [int(round(service[i])) for i in range(n)]

    def cb(a, b):
        f = mgr.IndexToNode(a)
        tt = mgr.IndexToNode(b)
        return T[f][tt] + S[f]

    idx = routing.RegisterTransitCallback(cb)
    routing.SetArcCostEvaluatorOfAllVehicles(idx)
    horizon = 48 * 3600
    routing.AddDimension(idx, horizon, horizon, False, "Time")
    tdim = routing.GetDimensionOrDie("Time")
    tdim.CumulVar(routing.Start(0)).SetRange(int(departure), int(departure))
    for node in range(n):
        if node == start:
            continue
        o, c = windows[node]
        index = mgr.NodeToIndex(node)
        if index < 0:
            continue
        if o is not None:
            tdim.CumulVar(index).SetMin(int(o))
        if c is not None:
            tdim.SetCumulVarSoftUpperBound(index, int(c), int(penalty))
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromSeconds(time_limit)
    sol = routing.SolveWithParameters(params)
    if not sol:
        return None
    order = []
    i = routing.Start(0)
    while not routing.IsEnd(i):
        order.append(mgr.IndexToNode(i))
        i = sol.Value(routing.NextVar(i))
    order.append(mgr.IndexToNode(i))
    return order


def path_cost(order, matrix, close):
    total = 0.0
    for i in range(len(order) - 1):
        v = matrix[order[i]][order[i + 1]]
        total += v if v is not None else 1e9
    if close and len(order) > 1:
        v = matrix[order[-1]][order[0]]
        total += v if v is not None else 1e9
    return total


def nn_path(matrix, start, interior):
    order = [start]
    cur = start
    unv = set(interior)
    while unv:
        nxt = min(unv, key=lambda j: matrix[cur][j] if matrix[cur][j] is not None else math.inf)
        order.append(nxt)
        unv.discard(nxt)
        cur = nxt
    return order


def two_opt_path(order, matrix, close, last_fixed):
    best = order[:]
    best_cost = path_cost(best, matrix, close)
    hi = len(best) - 2 if last_fixed else len(best) - 1
    improved = True
    while improved:
        improved = False
        for i in range(1, hi + 1):
            for k in range(i + 1, hi + 1):
                cand = best[:i] + best[i:k + 1][::-1] + best[k + 1:]
                c = path_cost(cand, matrix, close)
                if c + 1e-6 < best_cost:
                    best, best_cost = cand, c
                    improved = True
    return best


def or_opt_path(order, matrix, close, last_fixed):
    best = order[:]
    best_cost = path_cost(best, matrix, close)
    improved = True
    while improved:
        improved = False
        for seg in (1, 2, 3):
            hi = len(best) - 1 - seg if last_fixed else len(best) - seg
            for i in range(1, hi + 1):
                segment = best[i:i + seg]
                rest = best[:i] + best[i + seg:]
                max_j = len(rest) - 1 if last_fixed else len(rest)
                for j in range(1, max_j + 1):
                    if j == i:
                        continue
                    cand = rest[:j] + segment + rest[j:]
                    c = path_cost(cand, matrix, close)
                    if c + 1e-6 < best_cost:
                        best, best_cost = cand, c
                        improved = True
    return best


def solve_path(matrix, n, start, end, round_trip):
    if end is not None:
        interior = [i for i in range(n) if i != start and i != end]
        order = nn_path(matrix, start, interior) + [end]
        close, last_fixed = False, True
    else:
        interior = [i for i in range(n) if i != start]
        order = nn_path(matrix, start, interior)
        close, last_fixed = round_trip, False
    order = two_opt_path(order, matrix, close, last_fixed)
    order = or_opt_path(order, matrix, close, last_fixed)
    order = two_opt_path(order, matrix, close, last_fixed)
    return order, close


# --------------------------- Routes -------------------------------
@api_router.get("/")
async def root():
    return {"message": "Route Optimizer API"}


@api_router.get("/geocode")
async def geocode(q: str, limit: int = 6):
    if not q or len(q.strip()) < 3:
        return []
    return await geocode_query(q, limit)


async def _nominatim_search(c, q, limit):
    r = await c.get(f"{NOMINATIM}/search", params={"q": q, "format": "jsonv2", "limit": limit, "addressdetails": 1, "countrycodes": "es"})
    r.raise_for_status()
    return [
        {"display_name": d.get("display_name"), "lat": float(d["lat"]), "lon": float(d["lon"]), "type": d.get("type")}
        for d in r.json()
    ]


def _photon_name(p):
    parts = []
    if p.get("name"):
        parts.append(p["name"])
    line = " ".join(x for x in [p.get("street"), p.get("housenumber")] if x)
    if line:
        parts.append(line)
    for k in ("postcode", "city", "state", "country"):
        if p.get(k):
            parts.append(str(p[k]))
    seen, out = set(), []
    for x in parts:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return ", ".join(out)


async def _photon_search(c, q, limit):
    r = await c.get("https://photon.komoot.io/api/", params={"q": q, "limit": limit, "bbox": "-9.5,35.9,4.4,43.9"})
    r.raise_for_status()
    out = []
    for f in r.json().get("features", []):
        coord = f.get("geometry", {}).get("coordinates")
        if not coord or len(coord) < 2:
            continue
        props = f.get("properties", {})
        out.append({"display_name": _photon_name(props), "lat": float(coord[1]), "lon": float(coord[0]), "type": props.get("osm_value")})
    return out


async def geocode_query(q, limit=6):
    """Geocode with Nominatim, fall back to Photon on failure/429, with Mongo cache."""
    key = q.strip().lower()
    try:
        cached = await db.geocode_cache.find_one({"q": key}, {"_id": 0})
        if cached and cached.get("results"):
            return cached["results"][:limit]
    except Exception:
        pass
    results = []
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": UA}) as c:
        try:
            results = await _nominatim_search(c, q, 8)
        except Exception as e:
            logger.warning(f"nominatim fail for '{q}': {e}; trying photon")
        if not results:
            try:
                results = await _photon_search(c, q, 8)
            except Exception as e:
                logger.warning(f"photon fail for '{q}': {e}")
    if results:
        try:
            await db.geocode_cache.update_one({"q": key}, {"$set": {"q": key, "results": results}}, upsert=True)
        except Exception:
            pass
    return results[:limit]


async def _geocode_one(address: str):
    cands = await geocode_query(address, 1)
    if cands:
        return cands[0]["lat"], cands[0]["lon"]
    return None, None


async def _geocode_candidates(address: str):
    return await geocode_query(address, 5)


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _max_spread_km(cands):
    m = 0.0
    for i in range(len(cands)):
        for j in range(i + 1, len(cands)):
            d = _haversine_km(cands[i]["lat"], cands[i]["lon"], cands[j]["lat"], cands[j]["lon"])
            m = max(m, d)
    return m


def _service_seconds(stops):
    dumps = [s.model_dump() for s in stops]
    has_sm = any(d.get("service_min") is not None for d in dumps)
    if not has_sm:
        return None
    return sum(float(d.get("service_min") or 0) for d in dumps) * 60


def _parse_stops_from_df(df):
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
    c_type = pick("tipo de parada", "tipo", "type", "stop type")

    def norm_type(v):
        if v is None:
            return None
        t = str(v).strip().upper()
        return t if t in ("P", "PD", "L") else None

    stops = []
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
            "stop_type": norm_type(val(c_type)),
            "lat": float(lat) if lat is not None else None,
            "lon": float(lon) if lon is not None else None,
        }
        stops.append(stop)
    return stops


@api_router.post("/import-excel")
async def import_excel(file: UploadFile = File(...)):
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"No se pudo leer el archivo: {e}")

    stops = _parse_stops_from_df(df)
    to_geocode = [s for s in stops if (s["lat"] is None or s["lon"] is None) and s["address"]]

    # Geocode missing addresses with candidates (Nominatim -> Photon fallback, cached)
    pending_info = {}
    if to_geocode:
        for idx, stop in enumerate(to_geocode):
            if idx > 0:
                await asyncio.sleep(1.0)
            cands = await _geocode_candidates(stop["address"])
            if len(cands) == 1:
                stop["lat"] = cands[0]["lat"]
                stop["lon"] = cands[0]["lon"]
            elif len(cands) == 0:
                pending_info[stop["id"]] = {"reason": "not_found", "candidates": []}
            else:
                spread = _max_spread_km(cands)
                reason = "far_apart" if spread > 2.0 else "multiple"
                pending_info[stop["id"]] = {"reason": reason, "candidates": cands}

    resolved, pending = [], []
    for s in stops:
        if s["id"] in pending_info:
            info = pending_info[s["id"]]
            pending.append({**s, "reason": info["reason"], "candidates": info["candidates"]})
        elif s["lat"] is not None and s["lon"] is not None:
            resolved.append(s)
        else:
            pending.append({**s, "reason": "not_found", "candidates": []})

    untyped = sum(1 for s in stops if s["stop_type"] is None)
    return {
        "resolved": resolved,
        "pending": pending,
        "total": len(stops),
        "resolved_count": len(resolved),
        "pending_count": len(pending),
        "untyped_count": untyped,
    }


@api_router.post("/route")
async def compute_route(req: RouteRequest):
    nodes = []
    if req.start is not None:
        nodes.append(req.start)
    nodes += list(req.stops)
    if req.end is not None:
        nodes.append(req.end)

    return_to = None
    if req.end is None and req.round_trip:
        return_to = req.start if req.start is not None else (req.stops[0] if req.stops else None)

    geo_nodes = nodes[:]
    if return_to is not None:
        geo_nodes = nodes + [return_to]

    if len(geo_nodes) < 2:
        raise HTTPException(400, "Se necesitan al menos 2 puntos")

    result = await osrm_route(geo_nodes)
    service = _service_seconds(req.stops)
    if service is None:
        service = req.service_time_min * 60 * len(req.stops)

    departure_sec = _parse_hhmm(req.departure_time)
    if departure_sec is None:
        departure_sec = 8 * 3600
    stop_ids = {s.id for s in req.stops}
    schedule, end_sec = _compute_schedule(geo_nodes, result["leg_durations"], departure_sec, stop_ids)
    late_count = sum(1 for s in schedule if s["late"])
    return {
        "order": [s.id for s in req.stops],
        "summary": {
            "distance": result["distance"],
            "duration": result["duration"] + service,
            "drive_duration": result["duration"],
            "service_duration": service,
            "stops": len(req.stops),
            "departure": _fmt_hhmm(departure_sec),
            "end_time": _fmt_hhmm(end_sec),
            "late_count": late_count,
        },
        "schedule": schedule,
        "geometry": result["geometry"],
        "legs": result["legs"],
    }


@api_router.post("/optimize")
async def optimize(req: OptimizeRequest):
    n_stops = len(req.stops)

    if req.start is not None:
        nodes = [req.start] + list(req.stops)
        start_idx = 0
        stop_index_set = set(range(1, 1 + n_stops))
        end_idx = None
        if req.end is not None:
            nodes = nodes + [req.end]
            end_idx = len(nodes) - 1
    else:
        if n_stops < 2:
            raise HTTPException(400, "Se necesitan al menos 2 paradas para optimizar")
        nodes = list(req.stops)
        start_idx = req.depot_index if 0 <= req.depot_index < n_stops else 0
        stop_index_set = set(range(n_stops))
        end_idx = None

    N = len(nodes)
    if N < 2:
        raise HTTPException(400, "Se necesitan al menos 2 puntos para optimizar")

    durations, distances = await osrm_table(nodes)
    matrix = distances if req.metric == "distance" else durations
    other = durations if req.metric == "distance" else distances

    departure_sec = _parse_hhmm(req.departure_time)
    if departure_sec is None:
        departure_sec = 8 * 3600
    stop_ids = {s.id for s in req.stops}

    used_windows = False
    if req.respect_windows and ORTOOLS:
        service_list = []
        windows_list = []
        for i, nd in enumerate(nodes):
            d = nd.model_dump()
            if i in stop_index_set:
                service_list.append(float(d.get("service_min") or 0) * 60)
                windows_list.append((_parse_hhmm(d.get("window_from")), _parse_hhmm(d.get("window_to"))))
            else:
                service_list.append(0)
                windows_list.append((None, None))
        try:
            order_full = solve_vrptw(durations, service_list, windows_list, start_idx, end_idx, departure_sec)
        except Exception as e:
            logger.warning(f"VRPTW failed: {e}")
            order_full = None
        if order_full:
            used_windows = True
            geo_nodes = [nodes[i] for i in order_full]
            close = end_idx is None
            seen_ids = set()
            stop_order = []
            for i in order_full:
                if i in stop_index_set and nodes[i].id not in seen_ids:
                    seen_ids.add(nodes[i].id)
                    stop_order.append(nodes[i].id)

    if not used_windows:
        # Distance/time heuristic (no windows). Solve both metrics, keep best.
        order_main, close = solve_path(matrix, N, start_idx, end_idx, req.round_trip)
        order_other, _ = solve_path(other, N, start_idx, end_idx, req.round_trip)
        order = min([order_main, order_other], key=lambda o: path_cost(o, matrix, close))
        geo_nodes = [nodes[i] for i in order]
        if close:
            geo_nodes = geo_nodes + [nodes[start_idx]]
        stop_order = [nodes[i].id for i in order if i in stop_index_set]

    result = await osrm_route(geo_nodes)

    service = _service_seconds(req.stops)
    if service is None:
        service = req.service_time_min * 60 * n_stops

    schedule, end_sec = _compute_schedule(geo_nodes, result["leg_durations"], departure_sec, stop_ids)
    late_count = sum(1 for s in schedule if s["late"])
    return {
        "order": stop_order,
        "round_trip": close,
        "used_windows": used_windows,
        "summary": {
            "distance": result["distance"],
            "duration": result["duration"] + service,
            "drive_duration": result["duration"],
            "service_duration": service,
            "stops": n_stops,
            "departure": _fmt_hhmm(departure_sec),
            "end_time": _fmt_hhmm(end_sec),
            "late_count": late_count,
        },
        "schedule": schedule,
        "geometry": result["geometry"],
        "legs": result["legs"],
    }


@api_router.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"id": "default"}, {"_id": 0})
    if not doc:
        base = Settings().model_dump()
        base["id"] = "default"
        return base
    return doc


@api_router.put("/settings")
async def put_settings(body: Settings):
    doc = body.model_dump()
    doc["id"] = "default"
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"id": "default"}, {"$set": doc}, upsert=True)
    return doc


@api_router.get("/drivers", response_model=List[Driver])
async def list_drivers():
    docs = await db.drivers.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.post("/drivers", response_model=Driver)
async def create_driver(body: DriverCreate):
    doc = Driver(**body.model_dump())
    await db.drivers.insert_one(doc.model_dump())
    return doc


@api_router.put("/drivers/{driver_id}", response_model=Driver)
async def update_driver(driver_id: str, body: DriverCreate):
    existing = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Conductor no encontrado")
    update = body.model_dump()
    await db.drivers.update_one({"id": driver_id}, {"$set": update})
    return await db.drivers.find_one({"id": driver_id}, {"_id": 0})


@api_router.delete("/drivers/{driver_id}")
async def delete_driver(driver_id: str):
    res = await db.drivers.delete_one({"id": driver_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Conductor no encontrado")
    return {"ok": True}


@api_router.post("/routes", response_model=SavedRoute)
async def save_route(body: SavedRouteCreate):
    doc = SavedRoute(
        name=body.name,
        stops=[s.model_dump() for s in body.stops],
        metric=body.metric,
        round_trip=body.round_trip,
        depot_index=body.depot_index,
        start=body.start.model_dump() if body.start else None,
        end=body.end.model_dump() if body.end else None,
        service_time_min=body.service_time_min,
    )
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
        "start": body.start.model_dump() if body.start else None,
        "end": body.end.model_dump() if body.end else None,
        "service_time_min": body.service_time_min,
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
    type_label = {"P": "Particular", "PD": "PUDO", "L": "Locker"}
    for i, s in enumerate(req.stops):
        rows.append({
            "Orden": i + 1,
            "ID": s.order_id or s.id,
            "Nombre": s.name,
            "Dirección": s.address,
            "Tipo": type_label.get(s.stop_type, ""),
            "Min. parada": s.service_min if s.service_min is not None else "",
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


# ------------------------- Auth / Users / Assignments -------------------------
class LoginBody(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    nombres: str = ""
    apellidos: str = ""
    dni: str = ""
    telefono: str = ""
    marca: str = ""
    modelo: str = ""
    anio: str = ""
    matricula: str = ""
    cierre_seguridad: bool = False
    capacidad: str = ""
    tipologia: str = ""
    color: str = ""


class UserUpdate(BaseModel):
    password: Optional[str] = None
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    dni: Optional[str] = None
    telefono: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    anio: Optional[str] = None
    matricula: Optional[str] = None
    cierre_seguridad: Optional[bool] = None
    capacidad: Optional[str] = None
    tipologia: Optional[str] = None
    color: Optional[str] = None


class AssignmentBody(BaseModel):
    driver_id: str
    date: str
    name: str = ""
    stops: List[Stop]
    metric: str = "duration"
    start: Optional[Waypoint] = None
    end: Optional[Waypoint] = None
    round_trip: bool = True
    departure_time: Optional[str] = None


class OrderBody(BaseModel):
    date: str
    stops: List[Stop]


class CommentBody(BaseModel):
    stop_id: str
    comment: str = ""


class RouteConfigBody(BaseModel):
    number: str = ""
    driver_id: Optional[str] = None
    load_time: str = ""
    dock: Optional[int] = None
    departure_time: str = ""


class SimulationBody(BaseModel):
    stops: List[Stop]
    summary: Optional[dict] = None


class SacaPosition(BaseModel):
    position: int
    last4: str
    stop_id: Optional[str] = None
    stop_name: str = ""
    sacas: int = 0
    bultos: int = 0


class SacaIsolated(BaseModel):
    last4: str
    sacas: int = 0
    bultos: int = 0


class SacaSessionBody(BaseModel):
    positions: List[SacaPosition] = []
    isolated: List[SacaIsolated] = []


def create_token(u):
    payload = {"sub": u["id"], "role": u.get("role", "driver"), "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "No autenticado")
    try:
        payload = jwt.decode(authorization[7:], os.environ["JWT_SECRET"], algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Token inválido")
    doc = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0, "password_plain": 0})
    if not doc:
        raise HTTPException(401, "Usuario no encontrado")
    return doc


async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo el administrador puede hacer esto")
    return user


def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@api_router.post("/auth/login")
async def login(body: LoginBody):
    u = await db.users.find_one({"username": body.username})
    if not u or not bcrypt.checkpw(body.password.encode(), u["password_hash"].encode()):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    pub = {k: v for k, v in u.items() if k not in ("_id", "password_hash", "password_plain")}
    return {"token": create_token(u), "user": pub}


@api_router.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return user


@api_router.get("/users")
async def list_users(admin=Depends(require_admin)):
    return await db.users.find({"role": "driver"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)


@api_router.post("/users")
async def create_user(body: UserCreate, admin=Depends(require_admin)):
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(400, "Ese usuario ya existe")
    doc = body.model_dump()
    pw = doc.pop("password")
    doc["password_hash"] = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    doc["password_plain"] = pw
    doc["id"] = str(uuid.uuid4())
    doc["role"] = "driver"
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}


@api_router.put("/users/{uid}")
async def update_user(uid: str, body: UserUpdate, admin=Depends(require_admin)):
    if not await db.users.find_one({"id": uid, "role": "driver"}):
        raise HTTPException(404, "Conductor no encontrado")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    pw = upd.pop("password", None)
    if pw:
        upd["password_hash"] = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
        upd["password_plain"] = pw
    if upd:
        await db.users.update_one({"id": uid}, {"$set": upd})
    return await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})


@api_router.delete("/users/{uid}")
async def delete_user(uid: str, admin=Depends(require_admin)):
    r = await db.users.delete_one({"id": uid, "role": "driver"})
    if r.deleted_count == 0:
        raise HTTPException(404, "Conductor no encontrado")
    return {"ok": True}


@api_router.post("/assignments")
async def create_assignment(body: AssignmentBody, admin=Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    doc = body.model_dump()
    doc["updated_at"] = now
    await db.assignments.update_one(
        {"driver_id": body.driver_id, "date": body.date},
        {"$set": doc, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now}},
        upsert=True,
    )
    return await db.assignments.find_one({"driver_id": body.driver_id, "date": body.date}, {"_id": 0})


@api_router.get("/assignments")
async def list_assignments(driver_id: Optional[str] = None, date: Optional[str] = None, admin=Depends(require_admin)):
    q = {}
    if driver_id:
        q["driver_id"] = driver_id
    if date:
        q["date"] = date
    return await db.assignments.find(q, {"_id": 0}).sort("date", -1).to_list(1000)


@api_router.get("/my/route")
async def my_route(date: Optional[str] = None, user=Depends(get_current_user)):
    d = date or _today()
    doc = await db.assignments.find_one({"driver_id": user["id"], "date": d}, {"_id": 0})
    return {"date": d, "today": d == _today(), "assignment": doc}


@api_router.get("/my/dates")
async def my_dates(user=Depends(get_current_user)):
    return await db.assignments.find({"driver_id": user["id"]}, {"_id": 0, "date": 1, "name": 1}).sort("date", -1).to_list(500)


@api_router.put("/my/route/order")
async def my_order(body: OrderBody, user=Depends(get_current_user)):
    if body.date != _today():
        raise HTTPException(403, "Solo puedes editar la ruta de hoy")
    r = await db.assignments.update_one(
        {"driver_id": user["id"], "date": body.date},
        {"$set": {"stops": [s.model_dump() for s in body.stops], "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "No tienes ruta para hoy")
    return {"ok": True}


@api_router.put("/my/route/comment")
async def my_stop_comment(body: CommentBody, user=Depends(get_current_user)):
    d = _today()
    r = await db.assignments.update_one(
        {"driver_id": user["id"], "date": d, "stops.id": body.stop_id},
        {"$set": {"stops.$.driver_comment": body.comment, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Parada no encontrada")
    return {"ok": True}


@api_router.get("/my/sacas")
async def my_sacas(user=Depends(get_current_user)):
    rc = await db.route_configs.find_one({"driver_id": user["id"]}, {"_id": 0})
    if not rc:
        return {"route_number": None, "stops": [], "session": {"positions": [], "isolated": []}}
    return {
        "route_number": rc.get("number"),
        "stops": rc.get("stops", []),
        "session": rc.get("saca_session") or {"positions": [], "isolated": []},
    }


@api_router.put("/my/sacas")
async def save_my_sacas(body: SacaSessionBody, user=Depends(get_current_user)):
    rc = await db.route_configs.find_one({"driver_id": user["id"]})
    if not rc:
        raise HTTPException(404, "No tienes ruta asignada")
    await db.route_configs.update_one(
        {"id": rc["id"]},
        {"$set": {"saca_session": body.model_dump(), "saca_updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


# ---- Route Configs (Configuración de rutas, admin) ----
async def _enrich_config(doc):
    if not doc:
        return doc
    doc["stops_count"] = len(doc.get("stops", []))
    drv = None
    if doc.get("driver_id"):
        u = await db.users.find_one({"id": doc["driver_id"]}, {"_id": 0, "password_hash": 0})
        if u:
            drv = {"id": u["id"], "username": u.get("username"), "nombres": u.get("nombres", ""), "apellidos": u.get("apellidos", "")}
    doc["driver"] = drv
    return doc


@api_router.get("/route-configs")
async def list_route_configs(admin=Depends(require_admin)):
    docs = await db.route_configs.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    out = []
    for d in docs:
        d = await _enrich_config(d)
        d.pop("stops", None)
        d.pop("sim_stops", None)
        out.append(d)
    return out


@api_router.get("/route-configs/{cid}")
async def get_route_config(cid: str, admin=Depends(require_admin)):
    doc = await db.route_configs.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Ruta no encontrada")
    return await _enrich_config(doc)


@api_router.post("/route-configs")
async def create_route_config(body: RouteConfigBody, admin=Depends(require_admin)):
    if body.driver_id:
        if not await db.users.find_one({"id": body.driver_id, "role": "driver"}):
            raise HTTPException(404, "Conductor no encontrado")
        if await db.route_configs.find_one({"driver_id": body.driver_id}):
            raise HTTPException(409, "Ese conductor ya tiene una ruta asignada")
    now = datetime.now(timezone.utc).isoformat()
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "stops": [], "created_at": now, "updated_at": now})
    await db.route_configs.insert_one(doc)
    return await _enrich_config({k: v for k, v in doc.items() if k != "_id"})


@api_router.put("/route-configs/{cid}")
async def update_route_config(cid: str, body: RouteConfigBody, admin=Depends(require_admin)):
    existing = await db.route_configs.find_one({"id": cid})
    if not existing:
        raise HTTPException(404, "Ruta no encontrada")
    if body.driver_id:
        if not await db.users.find_one({"id": body.driver_id, "role": "driver"}):
            raise HTTPException(404, "Conductor no encontrado")
        dup = await db.route_configs.find_one({"driver_id": body.driver_id, "id": {"$ne": cid}})
        if dup:
            raise HTTPException(409, "Ese conductor ya tiene una ruta asignada")
    upd = body.model_dump()
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.route_configs.update_one({"id": cid}, {"$set": upd})
    doc = await db.route_configs.find_one({"id": cid}, {"_id": 0})
    return await _enrich_config(doc)


@api_router.delete("/route-configs/{cid}")
async def delete_route_config(cid: str, admin=Depends(require_admin)):
    r = await db.route_configs.delete_one({"id": cid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Ruta no encontrada")
    return {"ok": True}


@api_router.post("/route-configs/{cid}/stops")
async def update_config_stops(cid: str, file: UploadFile = File(...), admin=Depends(require_admin)):
    if not await db.route_configs.find_one({"id": cid}):
        raise HTTPException(404, "Ruta no encontrada")
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"No se pudo leer el archivo: {e}")
    stops = _parse_stops_from_df(df)
    # geocode missing coords automatically (best candidate, non-blocking)
    to_geo = [s for s in stops if (s["lat"] is None or s["lon"] is None) and s["address"]]
    for idx, s in enumerate(to_geo):
        if idx > 0:
            await asyncio.sleep(1.0)
        cands = await _geocode_candidates(s["address"])
        if cands:
            s["lat"] = cands[0]["lat"]
            s["lon"] = cands[0]["lon"]
    stops = [s for s in stops if s["lat"] is not None and s["lon"] is not None]
    now = datetime.now(timezone.utc).isoformat()
    await db.route_configs.update_one({"id": cid}, {"$set": {"stops": stops, "updated_at": now}})
    doc = await db.route_configs.find_one({"id": cid}, {"_id": 0})
    return await _enrich_config(doc)


@api_router.post("/route-configs/{cid}/simulation")
async def save_simulation(cid: str, body: SimulationBody, admin=Depends(require_admin)):
    if not await db.route_configs.find_one({"id": cid}):
        raise HTTPException(404, "Ruta no encontrada")
    now = datetime.now(timezone.utc).isoformat()
    await db.route_configs.update_one({"id": cid}, {"$set": {
        "sim_stops": [s.model_dump() for s in body.stops],
        "sim_summary": body.summary,
        "sim_updated_at": now,
        "updated_at": now,
    }})
    doc = await db.route_configs.find_one({"id": cid}, {"_id": 0})
    return await _enrich_config(doc)


@app.on_event("startup")
async def _seed_admin():
    au = os.environ["ADMIN_USERNAME"]
    ap = os.environ["ADMIN_PASSWORD"]
    ex = await db.users.find_one({"username": au})
    if not ex:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "username": au,
            "password_hash": bcrypt.hashpw(ap.encode(), bcrypt.gensalt()).decode(),
            "role": "admin", "nombres": "Master", "apellidos": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not bcrypt.checkpw(ap.encode(), ex["password_hash"].encode()):
        await db.users.update_one({"username": au}, {"$set": {"password_hash": bcrypt.hashpw(ap.encode(), bcrypt.gensalt()).decode()}})


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
