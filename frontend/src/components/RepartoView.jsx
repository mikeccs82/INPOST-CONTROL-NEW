import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Navigation, PackageCheck, Flag, CheckCircle2, PackageOpen, PackagePlus, ArrowRight, ShoppingBag, Package, Minus, Plus } from "lucide-react";
import { myRouteConfig, mySacas } from "../lib/api";

const gmapsUrl = (s) => {
  if (s.lat != null && s.lon != null) return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=driving`;
  const q = encodeURIComponent(s.address || s.name || "");
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
};

export const RepartoView = () => {
  const [loading, setLoading] = useState(true);
  const [stops, setStops] = useState([]);
  const [meta, setMeta] = useState({}); // stop_id -> {sacas, bultos, position, order_id}
  const [routeNumber, setRouteNumber] = useState(null);

  const [idx, setIdx] = useState(0);
  const [atSite, setAtSite] = useState(false);
  const [mode, setMode] = useState(null);      // null | 'entregar' | 'recoger'
  const [delivered, setDelivered] = useState(false);
  const [pickedUp, setPickedUp] = useState(false);
  const [pickQty, setPickQty] = useState(0);

  useEffect(() => {
    Promise.all([myRouteConfig(), mySacas()])
      .then(([rc, sc]) => {
        setRouteNumber(rc.route_number);
        setStops(rc.driver_route?.stops || []);
        const m = {};
        (sc.session?.positions || []).forEach((p) => { if (p.stop_id) m[p.stop_id] = p; });
        setMeta(m);
      })
      .catch(() => toast.error("No se pudo cargar la ruta"))
      .finally(() => setLoading(false));
  }, []);

  const resetStopState = () => { setAtSite(false); setMode(null); setDelivered(false); setPickedUp(false); setPickQty(0); };
  const goNext = () => { resetStopState(); setIdx((i) => i + 1); };

  const irA = (s) => window.open(gmapsUrl(s), "_blank", "noopener");

  if (loading) return <div className="flex-1 flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-[#F26A21]" /></div>;

  if (stops.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-slate-950">
      <PackageCheck size={40} className="text-slate-600 mb-3" />
      <p className="text-slate-300 font-semibold mb-1">No hay ruta preparada</p>
      <p className="text-slate-500 text-sm">Prepara y carga tu ruta en los pasos anteriores.</p>
    </div>
  );

  const finished = idx >= stops.length;
  const cur = finished ? null : stops[idx];
  const curMeta = cur ? (meta[cur.id] || {}) : {};

  return (
    <div data-testid="reparto-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white">Ruta a Reparto</h1>
          <span className="text-sm font-mono-tech text-slate-300">{Math.min(idx + (finished ? 0 : 1), stops.length)} / {stops.length}</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">{routeNumber ? `Ruta ${routeNumber}` : ""}</p>

        {finished ? (
          <div className="rounded-2xl bg-emerald-600/10 border border-emerald-500/30 p-6 text-center">
            <Flag size={34} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-white font-bold text-lg">¡Ruta completada!</p>
            <p className="text-slate-400 text-sm mt-1">Has visitado todas las paradas.</p>
          </div>
        ) : (
          <div data-testid="reparto-current" className="rounded-2xl bg-slate-900 border border-[#F26A21]/40 p-4 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#F26A21] flex items-center justify-center shrink-0 text-white font-extrabold text-lg">{idx + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="text-white font-bold truncate">{cur.name || `Parada ${idx + 1}`}</div>
                <div className="text-sm text-slate-400 truncate flex items-center gap-1"><MapPin size={12} className="shrink-0" /> {cur.address || "—"}</div>
              </div>
            </div>

            {/* Fase viaje */}
            {!atSite && (
              <div className="space-y-2">
                <button data-testid="reparto-ir" onClick={() => irA(cur)}
                  className="w-full flex items-center justify-center gap-2.5 bg-[#F26A21] hover:bg-[#f58220] text-white font-extrabold text-lg py-4 rounded-2xl transition-colors active:scale-[0.98] shadow-lg shadow-orange-900/30">
                  <Navigation size={24} /> Ir con Google Maps
                </button>
                <button data-testid="reparto-at-site" onClick={() => setAtSite(true)}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-3.5 rounded-xl transition-colors">
                  <MapPin size={18} /> Ya estoy en el sitio
                </button>
              </div>
            )}

            {/* Fase en sitio: elegir acción */}
            {atSite && mode === null && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button data-testid="reparto-entregar" onClick={() => setMode("entregar")} disabled={delivered}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-bold transition-colors disabled:opacity-50 bg-emerald-600 hover:bg-emerald-500 text-white">
                    {delivered ? <CheckCircle2 size={22} /> : <PackageOpen size={22} />}
                    {delivered ? "Entregado" : "Entregar"}
                  </button>
                  <button data-testid="reparto-recoger" onClick={() => setMode("recoger")} disabled={pickedUp}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-bold transition-colors disabled:opacity-50 bg-[#1E5AA8] hover:bg-[#184a8c] text-white">
                    {pickedUp ? <CheckCircle2 size={22} /> : <PackagePlus size={22} />}
                    {pickedUp ? `Recogido (${pickQty})` : "Recoger"}
                  </button>
                </div>
                <button data-testid="reparto-next-stop" onClick={goNext}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-3 rounded-xl transition-colors">
                  {idx + 1 >= stops.length ? "Finalizar ruta" : "Siguiente parada"} <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* Entregar */}
            {atSite && mode === "entregar" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 font-semibold">Cantidad a entregar:</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#F26A21]/10 border border-[#F26A21]/30 p-3 flex items-center gap-2">
                    <ShoppingBag size={22} className="text-[#F26A21]" />
                    <div><div data-testid="reparto-entregar-sacas" className="text-3xl font-extrabold text-white leading-none">{curMeta.sacas ?? 0}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">Sacas</div></div>
                  </div>
                  <div className="rounded-lg bg-[#1E5AA8]/10 border border-[#1E5AA8]/30 p-3 flex items-center gap-2">
                    <Package size={22} className="text-[#4b8fe0]" />
                    <div><div data-testid="reparto-entregar-bultos" className="text-3xl font-extrabold text-white leading-none">{curMeta.bultos ?? 0}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">Bultos</div></div>
                  </div>
                </div>
                <button data-testid="reparto-entregado" onClick={() => { setDelivered(true); setMode(null); toast.success("Entrega registrada"); }}
                  className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg py-4 rounded-2xl transition-colors active:scale-[0.98]">
                  <CheckCircle2 size={24} /> Entregado
                </button>
              </div>
            )}

            {/* Recoger */}
            {atSite && mode === "recoger" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 font-semibold">¿Cuántas sacas recoges?</p>
                <div className="flex items-center justify-center gap-4">
                  <button data-testid="reparto-pick-minus" onClick={() => setPickQty((q) => Math.max(0, q - 1))}
                    className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-600 text-white flex items-center justify-center active:scale-95"><Minus size={22} /></button>
                  <div data-testid="reparto-pick-qty" className="text-5xl font-extrabold text-white w-20 text-center">{pickQty}</div>
                  <button data-testid="reparto-pick-plus" onClick={() => setPickQty((q) => q + 1)}
                    className="w-12 h-12 rounded-xl bg-[#1E5AA8] text-white flex items-center justify-center active:scale-95"><Plus size={22} /></button>
                </div>
                <button data-testid="reparto-recogido" onClick={() => { setPickedUp(true); setMode(null); toast.success(`Recogida registrada: ${pickQty} sacas`); }}
                  className="w-full flex items-center justify-center gap-2.5 bg-[#1E5AA8] hover:bg-[#184a8c] text-white font-extrabold text-lg py-4 rounded-2xl transition-colors active:scale-[0.98]">
                  <CheckCircle2 size={24} /> Recogido
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lista completa con estado */}
        <h2 className="text-sm font-bold text-slate-300 mb-2">Todas las paradas</h2>
        <div className="space-y-2">
          {stops.map((s, i) => {
            const done = i < idx;
            const isCur = i === idx && !finished;
            return (
              <div key={s.id} data-testid={`reparto-stop-${i + 1}`}
                className={`rounded-xl p-3 flex items-center gap-3 border ${isCur ? "bg-[#F26A21]/10 border-[#F26A21]/40" : done ? "bg-slate-900/60 border-slate-800" : "bg-slate-900 border-slate-700"}`}>
                <div className={`shrink-0 w-9 h-9 rounded-full font-bold flex items-center justify-center ${done ? "bg-emerald-600 text-white" : isCur ? "bg-[#F26A21] text-white" : "bg-slate-800 border border-slate-600 text-white"}`}>
                  {done ? <CheckCircle2 size={18} /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${done ? "text-slate-500 line-through" : "text-white"}`}>{s.name || `Parada ${i + 1}`}</div>
                  <div className="text-xs text-slate-500 truncate">{s.address || "—"}</div>
                </div>
                {done && <span className="text-[10px] font-bold uppercase text-emerald-400 shrink-0">Hecha</span>}
                {isCur && <span className="text-[10px] font-bold uppercase text-[#F26A21] shrink-0">Actual</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
