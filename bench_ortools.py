import pandas as pd, requests, time
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

BASE = "http://localhost:8001/api"
OSRM = "https://router.project-osrm.org"
UA = {"User-Agent": "RouteOptimizer/1.0 benchmark"}

df = pd.read_excel("/app/sample_stops.xlsx")
stops = []
for idx, r in df.iterrows():
    if pd.notna(r["Latitud"]) and pd.notna(r["Longitud"]):
        stops.append({"id": f"s{idx}", "name": str(r["Nombre de ubicación"]),
                      "lat": float(r["Latitud"]), "lon": float(r["Longitud"])})

def osrm_table(nodes):
    coords = ";".join(f"{n['lon']},{n['lat']}" for n in nodes)
    url = f"{OSRM}/table/v1/driving/{coords}?annotations=duration,distance"
    d = requests.get(url, headers=UA, timeout=60).json()
    return d["durations"], d["distances"]

def route_summary(ordered, meta):
    d = requests.post(f"{BASE}/route", json={"stops": ordered, **meta}, timeout=60).json()
    return d["summary"]

def ortools_order(matrix, depot, time_limit=6):
    n = len(matrix)
    mgr = pywrapcp.RoutingIndexManager(n, 1, depot)
    routing = pywrapcp.RoutingModel(mgr)
    M = [[int(round(matrix[i][j])) if matrix[i][j] is not None else 10**9 for j in range(n)] for i in range(n)]
    def cb(a, b): return M[mgr.IndexToNode(a)][mgr.IndexToNode(b)]
    t = routing.RegisterTransitCallback(cb)
    routing.SetArcCostEvaluatorOfAllVehicles(t)
    p = pywrapcp.DefaultRoutingSearchParameters()
    p.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    p.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    p.time_limit.FromSeconds(time_limit)
    sol = routing.SolveWithParameters(p)
    order = []
    i = routing.Start(0)
    while not routing.IsEnd(i):
        order.append(mgr.IndexToNode(i)); i = sol.Value(routing.NextVar(i))
    return order

def run_case(title, meta, wh):
    print("\n=====================", title, "=====================")
    # current app heuristic
    t0 = time.time()
    opt = requests.post(f"{BASE}/optimize", json={"stops": stops, "metric": "duration", **meta}, timeout=120).json()
    t_heur = time.time() - t0
    byid = {s["id"]: s for s in stops}
    cur_order = [byid[i] for i in opt["order"]]
    cur = opt["summary"]

    # nodes for OR-Tools
    if wh:
        nodes = [wh] + stops
        depot = 0
    else:
        nodes = stops
        depot = stops.index(cur_order[0])  # same fixed start as app fallback
    dur, dist = osrm_table(nodes)
    t1 = time.time()
    o = ortools_order(dur, depot, time_limit=6)
    t_or = time.time() - t1

    if wh:
        or_stops = [nodes[i] for i in o if i != 0]  # drop warehouse node
    else:
        or_stops = [nodes[i] for i in o]
    ors = route_summary(or_stops, meta)

    print(f"  ACTUAL (heurística) : {cur['distance']/1000:6.2f} km | conducción {cur['drive_duration']/60:5.1f} min   (calc {t_heur:.1f}s)")
    print(f"  OR-TOOLS            : {ors['distance']/1000:6.2f} km | conducción {ors['drive_duration']/60:5.1f} min   (calc {t_or:.1f}s)")
    dmin = (ors['drive_duration'] - cur['drive_duration'])/60
    dkm = (ors['distance'] - cur['distance'])/1000
    pct = (ors['drive_duration'] - cur['drive_duration'])/cur['drive_duration']*100
    print(f"  DIFERENCIA OR-Tools : {dmin:+.1f} min ({pct:+.1f}%) | {dkm:+.2f} km   (negativo = OR-Tools mejor)")

run_case("SIN ALMACÉN (ida y vuelta entre paradas)", {"start": None, "end": None, "round_trip": True, "service_time_min": 0}, None)

wh = {"id": "wh", "name": "Almacen ejemplo", "lat": 41.3600, "lon": 2.1100}
run_case("CON ALMACÉN de ejemplo (41.3600, 2.1100)", {"start": wh, "end": None, "round_trip": True, "service_time_min": 0}, wh)
