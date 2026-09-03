import pandas as pd, requests, math

BASE = "http://localhost:8001/api"
addr = "Carrer de les Oliveres, 1, 08800 Vilanova i la Geltru, Barcelona"
g = requests.get(f"{BASE}/geocode", params={"q": addr}).json()
print("geocode ->", g[0]["display_name"] if g else "SIN RESULTADO")
wh = {"id": "wh", "name": "Almacen BoxLogic", "lat": g[0]["lat"], "lon": g[0]["lon"]}
print("almacén:", wh["lat"], wh["lon"])

df = pd.read_excel("/app/sample_stops.xlsx")
stops = []
for idx, r in df.iterrows():
    if pd.notna(r["Latitud"]) and pd.notna(r["Longitud"]):
        stops.append({"id": f"s{idx}", "name": str(r["Nombre de ubicación"]),
                      "lat": float(r["Latitud"]), "lon": float(r["Longitud"])})

meta = {"start": wh, "end": None, "round_trip": True, "service_time_min": 0}

def rsum(ordered):
    d = requests.post(f"{BASE}/route", json={"stops": ordered, **meta}, timeout=60).json()
    return d["summary"]

def seg_dist(p, a, b):
    ax=a["lon"]*111320*math.cos(math.radians(a["lat"])); ay=a["lat"]*110540
    bx=b["lon"]*111320*math.cos(math.radians(b["lat"])); by=b["lat"]*110540
    px=p["lon"]*111320*math.cos(math.radians(p["lat"])); py=p["lat"]*110540
    dx,dy=bx-ax,by-ay
    if dx==0 and dy==0: return math.hypot(px-ax,py-ay)
    t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)))
    return math.hypot(px-(ax+t*dx), py-(ay+t*dy))

for metric in ["duration", "distance"]:
    print("\n============ METRIC:", metric, "============")
    opt = requests.post(f"{BASE}/optimize", json={"stops": stops, "metric": metric, **meta}, timeout=120).json()
    byid = {s["id"]: s for s in stops}
    ordered = [byid[i] for i in opt["order"]]
    n = len(ordered); cur = opt["summary"]
    print(f"actual: {n} paradas | {cur['distance']/1000:.2f} km | conducción {cur['drive_duration']/60:.1f} min")
    for pos in (7, 8, 33):
        if pos <= n: print(f"  pos {pos}: {ordered[pos-1]['name']}")
    if n >= 33:
        d = seg_dist(ordered[32], ordered[6], ordered[7])
        print(f"  distancia #33 al tramo 7->8: {d:.0f} m")
        cand = ordered[:7] + [ordered[32]] + ordered[7:32] + ordered[33:]
        cs = rsum(cand)
        dd=(cs['drive_duration']-cur['drive_duration'])/60; dk=(cs['distance']-cur['distance'])/1000
        print(f"  candidato (33 tras la 7): {cs['distance']/1000:.2f} km | {cs['drive_duration']/60:.1f} min  => DELTA {dd:+.1f} min | {dk:+.2f} km")
