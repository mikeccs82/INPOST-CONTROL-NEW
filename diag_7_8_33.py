import pandas as pd, requests, math, json

BASE = "http://localhost:8001/api"

df = pd.read_excel("/app/sample_stops.xlsx")
stops = []
for idx, r in df.iterrows():
    if pd.notna(r["Latitud"]) and pd.notna(r["Longitud"]):
        stops.append({
            "id": f"s{idx}",
            "name": str(r["Nombre de ubicación"]),
            "lat": float(r["Latitud"]),
            "lon": float(r["Longitud"]),
        })
print("stops cargadas:", len(stops))

settings = requests.get(f"{BASE}/settings").json()
start = settings.get("start")
end = settings.get("end")
same = settings.get("same_as_start", True)
svc = settings.get("service_time_min", 0) or 0
print("almacén salida:", (start or {}).get("address"), "| service_time_min:", svc, "| misma llegada:", same)

meta = {
    "start": start,
    "end": None if same else end,
    "round_trip": bool(same),
    "service_time_min": svc,
}

def route_summary(ordered):
    body = {"stops": ordered, **meta}
    d = requests.post(f"{BASE}/route", json=body, timeout=60).json()
    return d["summary"]

def seg_point_dist(p, a, b):
    # approx meters distance from point p to segment a-b (lat/lon), small-area planar
    def m(lat): return 111320.0
    ax=(a["lon"])*111320*math.cos(math.radians(a["lat"])); ay=a["lat"]*110540
    bx=(b["lon"])*111320*math.cos(math.radians(b["lat"])); by=b["lat"]*110540
    px=(p["lon"])*111320*math.cos(math.radians(p["lat"])); py=p["lat"]*110540
    dx,dy=bx-ax,by-ay
    if dx==0 and dy==0: return math.hypot(px-ax,py-ay)
    t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)))
    cx,cy=ax+t*dx,ay+t*dy
    return math.hypot(px-cx,py-cy)

for metric in ["duration", "distance"]:
    print("\n================= METRIC:", metric, "=================")
    opt = requests.post(f"{BASE}/optimize", json={"stops": stops, "metric": metric, **meta}, timeout=90).json()
    order_ids = opt["order"]
    byid = {s["id"]: s for s in stops}
    ordered = [byid[i] for i in order_ids]
    n = len(ordered)
    cur = opt["summary"]
    print(f"orden actual: {n} paradas | dist {cur['distance']/1000:.2f} km | conducción {cur['drive_duration']/60:.1f} min | total {cur['duration']/60:.1f} min")

    # positions (1-based) 7,8,33 -> indices 6,7,32
    for pos in (7, 8, 33):
        if pos <= n:
            print(f"  pos {pos}: {ordered[pos-1]['name']}")

    if n >= 33:
        p7, p8, p33 = ordered[6], ordered[7], ordered[32]
        dseg = seg_point_dist(p33, p7, p8)
        print(f"  distancia aprox de la #33 al tramo 7->8: {dseg:.0f} m")

        # candidate: mover la #33 a justo despues de la #7 (queda como #8)
        cand = ordered[:7] + [ordered[32]] + ordered[7:32] + ordered[33:]
        assert len(cand) == n and {s['id'] for s in cand}=={s['id'] for s in ordered}
        cs = route_summary(cand)
        print(f"  orden candidato (33 insertada tras la 7):")
        print(f"     dist {cs['distance']/1000:.2f} km | conducción {cs['drive_duration']/60:.1f} min | total {cs['duration']/60:.1f} min")
        dd = cs['drive_duration'] - cur['drive_duration']
        dk = (cs['distance'] - cur['distance'])/1000
        print(f"  DELTA candidato - actual: {dd/60:+.1f} min conducción | {dk:+.2f} km")
