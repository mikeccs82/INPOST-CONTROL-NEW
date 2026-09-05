import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Navigation, PackageCheck, Flag, CheckCircle2, PackageOpen, PackagePlus, ArrowRight, ShoppingBag, Package, Minus, Plus, AlertTriangle, Clock, X, DoorClosed } from "lucide-react";
import { myRouteConfig, mySacas, myReparto, saveMyReparto } from "../lib/api";

const gmapsUrl = (s) => {
  if (s.lat != null && s.lon != null) return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=driving`;
  const q = encodeURIComponent(s.address || s.name || "");
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
};
const irA = (s) => window.open(gmapsUrl(s), "_blank", "noopener");
const fmtWindow = (s) => {
  const f = s.window_from, t = s.window_to;
  if (!f && !t) return null;
  return `${f || "—"} - ${t || "—"}`;
};

export const RepartoView = () => {
  const [loading, setLoading] = useState(true);
  const [stops, setStops] = useState([]);
  const [meta, setMeta] = useState({});
  const [routeNumber, setRouteNumber] = useState(null);

  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState({}); // stop_id -> {delivered, deliveredSacas, deliveredBultos, pickedUp, pickupSacas, incidencia:{tipo,detalle}, done}

  const [atSite, setAtSite] = useState(false);
  const [mode, setMode] = useState(null);       // null | 'entregar' | 'recoger'
  const [pickQty, setPickQty] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  const [incModal, setIncModal] = useState(false);      // incidencia en sitio (cerrado)
  const [defDetail, setDefDetail] = useState(null);     // string | null -> textarea "cerrado definitivo"
  const [endModal, setEndModal] = useState(false);      // "¿hubo alguna incidencia?" al terminar
  const [endDetail, setEndDetail] = useState(null);     // string | null -> textarea de detalle final

  useEffect(() => {
    Promise.all([myRouteConfig(), mySacas(), myReparto()])
      .then(([rc, sc, rp]) => {
        setRouteNumber(rc.route_number);
        setStops(rc.driver_route?.stops || []);
        const m = {};
        (sc.session?.positions || []).forEach((p) => { if (p.stop_id) m[p.stop_id] = p; });
        setMeta(m);
        setIdx(rp.idx || 0);
        setProgress(rp.stops || {});
      })
      .catch(() => toast.error("No se pudo cargar la ruta"))
      .finally(() => setLoading(false));
  }, []);

  const persist = (nextIdx, nextProgress) => { saveMyReparto(nextIdx, nextProgress).catch(() => {}); };
  const resetLocal = () => { setAtSite(false); setMode(null); setPickQty(0); setIncModal(false); setDefDetail(null); setEndModal(false); setEndDetail(null); };

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
  const curP = cur ? (progress[cur.id] || {}) : {};
  const onsite = atSite || !!(curP.delivered || curP.pickedUp || curP.incidencia);
  const serviced = !!(curP.delivered || curP.pickedUp);

  const setStopProgress = (patch, opts = {}) => {
    const np = { ...progress, [cur.id]: { ...(progress[cur.id] || {}), ...patch } };
    setProgress(np);
    persist(opts.advance ? idx + 1 : idx, np);
    return np;
  };

  const advance = (extraPatch = {}) => {
    const np = { ...progress, [cur.id]: { ...(progress[cur.id] || {}), ...extraPatch } };
    const nextIdx = idx + 1;
    setProgress(np); setIdx(nextIdx); persist(nextIdx, np); resetLocal();
  };

  const onEntregado = () => { setStopProgress({ delivered: true, deliveredSacas: curMeta.sacas ?? 0, deliveredBultos: curMeta.bultos ?? 0 }); setMode(null); toast.success("Entrega registrada"); };
  const onRecogido = () => { setStopProgress({ pickedUp: true, pickupSacas: pickQty }); setMode(null); toast.success(`Recogida registrada: ${pickQty} sacas`); };

  // Incidencia en sitio (cerrado)
  const incVuelvo = () => { advance({ incidencia: { tipo: "vuelvo", detalle: "Cerrado, vuelvo más tarde" }, done: false }); toast.info("Marcado: vuelvo más tarde"); };
  const incDefinitivo = () => { advance({ incidencia: { tipo: "definitivo", detalle: defDetail || "" }, done: true }); toast.warning("Cerrado definitivo registrado"); };

  // Siguiente parada tras servir -> preguntar incidencia
  const onNextStop = () => { if (serviced) setEndModal(true); else advance(); };
  const endSi = () => { setEndDetail(""); };
  const endNo = () => { advance({ done: true }); };
  const endGuardar = () => { advance({ done: true, incidencia: { tipo: "general", detalle: endDetail || "" } }); };

  const badgeOf = (p) => {
    if (!p) return null;
    if (p.incidencia?.tipo === "definitivo") return { t: "Cerrado", c: "text-red-400" };
    if (p.incidencia?.tipo === "vuelvo") return { t: "Vuelvo", c: "text-amber-400" };
    if (p.done) return { t: "Hecha", c: "text-emerald-400" };
    return null;
  };

  return (
    <div data-testid="reparto-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white">Ruta a Reparto</h1>
          <span className="text-sm font-mono-tech text-slate-300">{Math.min(idx + (finished ? 0 : 1), stops.length)} / {stops.length}</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">{routeNumber ? `Ruta ${routeNumber}` : ""}</p>

        {finished ? (
          <div className="rounded-2xl bg-emerald-600/10 border border-emerald-500/30 p-6 text-center mb-4">
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
                {fmtWindow(cur) && <div className="text-xs text-[#F26A21] font-semibold flex items-center gap-1 mt-0.5"><Clock size={12} className="shrink-0" /> {fmtWindow(cur)}</div>}
                <div className="text-sm text-slate-400 truncate flex items-center gap-1 mt-0.5"><MapPin size={12} className="shrink-0" /> {cur.address || "—"}</div>
              </div>
            </div>

            {!onsite && (
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

            {onsite && mode === null && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button data-testid="reparto-entregar" onClick={() => setMode("entregar")} disabled={curP.delivered}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-bold transition-colors disabled:opacity-60 bg-emerald-600 hover:bg-emerald-500 text-white">
                    {curP.delivered ? <CheckCircle2 size={22} /> : <PackageOpen size={22} />}
                    {curP.delivered ? "Entregado" : "Entregar"}
                  </button>
                  <button data-testid="reparto-recoger" onClick={() => { setPickQty(curP.pickupSacas || 0); setMode("recoger"); }} disabled={curP.pickedUp}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-bold transition-colors disabled:opacity-60 bg-[#1E5AA8] hover:bg-[#184a8c] text-white">
                    {curP.pickedUp ? <CheckCircle2 size={22} /> : <PackagePlus size={22} />}
                    {curP.pickedUp ? `Recogido (${curP.pickupSacas})` : "Recoger"}
                  </button>
                </div>
                <button data-testid="reparto-incidencia" onClick={() => setIncModal(true)}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600/90 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors">
                  <AlertTriangle size={18} /> Incidencia
                </button>
                <button data-testid="reparto-next-stop" onClick={onNextStop}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-3 rounded-xl transition-colors">
                  {idx + 1 >= stops.length ? "Finalizar ruta" : "Siguiente parada"} <ArrowRight size={18} />
                </button>
              </div>
            )}

            {onsite && mode === "entregar" && (
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
                <div className="flex gap-2">
                  <button onClick={() => setMode(null)} className="flex-1 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl transition-colors">Volver</button>
                  <button data-testid="reparto-entregado" onClick={onEntregado}
                    className="flex-[2] flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg py-3 rounded-xl transition-colors active:scale-[0.98]">
                    <CheckCircle2 size={22} /> Entregado
                  </button>
                </div>
              </div>
            )}

            {onsite && mode === "recoger" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 font-semibold">¿Cuántas sacas recoges?</p>
                <div className="flex items-center justify-center gap-4">
                  <button data-testid="reparto-pick-minus" onClick={() => setPickQty((q) => Math.max(0, q - 1))}
                    className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-600 text-white flex items-center justify-center active:scale-95"><Minus size={22} /></button>
                  <div data-testid="reparto-pick-qty" className="text-5xl font-extrabold text-white w-20 text-center">{pickQty}</div>
                  <button data-testid="reparto-pick-plus" onClick={() => setPickQty((q) => q + 1)}
                    className="w-12 h-12 rounded-xl bg-[#1E5AA8] text-white flex items-center justify-center active:scale-95"><Plus size={22} /></button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setMode(null)} className="flex-1 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl transition-colors">Volver</button>
                  <button data-testid="reparto-recogido" onClick={onRecogido}
                    className="flex-[2] flex items-center justify-center gap-2.5 bg-[#1E5AA8] hover:bg-[#184a8c] text-white font-extrabold text-lg py-3 rounded-xl transition-colors active:scale-[0.98]">
                    <CheckCircle2 size={22} /> Recogido
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lista completa con estado, selección + Ir */}
        <h2 className="text-sm font-bold text-slate-300 mb-2">Todas las paradas</h2>
        <div className="space-y-2">
          {stops.map((s, i) => {
            const done = i < idx;
            const isCur = i === idx && !finished;
            const badge = badgeOf(progress[s.id]);
            const sel = selectedId === s.id;
            const w = fmtWindow(s);
            return (
              <div key={s.id} className={`rounded-xl border transition-colors ${sel ? "border-[#F26A21]" : isCur ? "border-[#F26A21]/40" : "border-slate-700"} ${isCur ? "bg-[#F26A21]/10" : "bg-slate-900"}`}>
                <button data-testid={`reparto-stop-${i + 1}`} onClick={() => setSelectedId(sel ? null : s.id)}
                  className="w-full text-left p-3 flex items-center gap-3">
                  <div className={`shrink-0 w-9 h-9 rounded-full font-bold flex items-center justify-center ${done ? "bg-emerald-600 text-white" : isCur ? "bg-[#F26A21] text-white" : "bg-slate-800 border border-slate-600 text-white"}`}>
                    {done ? <CheckCircle2 size={18} /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-white">{s.name || `Parada ${i + 1}`}</div>
                    {w && <div className="text-[11px] text-[#F26A21] font-semibold flex items-center gap-1"><Clock size={11} className="shrink-0" /> {w}</div>}
                    <div className="text-xs text-slate-500 truncate">{s.address || "—"}</div>
                  </div>
                  {badge && <span className={`text-[10px] font-bold uppercase shrink-0 ${badge.c}`}>{badge.t}</span>}
                  {isCur && !badge && <span className="text-[10px] font-bold uppercase text-[#F26A21] shrink-0">Actual</span>}
                </button>
                {sel && (
                  <div className="px-3 pb-3 space-y-2">
                    <button data-testid={`reparto-ir-list-${i + 1}`} onClick={() => irA(s)}
                      className="w-full flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white text-sm font-bold py-2.5 rounded-lg transition-colors active:scale-95">
                      <Navigation size={16} /> Ir con Google Maps
                    </button>
                    <button data-testid={`reparto-atsite-list-${i + 1}`} onClick={() => { setIdx(i); persist(i, progress); resetLocal(); setAtSite(true); setSelectedId(null); }}
                      className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-sm font-bold py-2.5 rounded-lg transition-colors active:scale-95">
                      <MapPin size={16} /> Ya estoy en el sitio
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal incidencia en sitio */}
      {incModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setIncModal(false); setDefDetail(null); }}>
          <div data-testid="reparto-inc-modal" onClick={(e) => e.stopPropagation()} className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0"><AlertTriangle size={20} className="text-amber-400" /></div>
              <div className="flex-1"><h3 className="font-bold text-white">Incidencia</h3><p className="text-sm text-slate-300 mt-0.5">¿Qué ocurre en esta parada?</p></div>
              <button onClick={() => { setIncModal(false); setDefDetail(null); }} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            {defDetail === null ? (
              <div className="space-y-2">
                <button data-testid="reparto-inc-vuelvo" onClick={incVuelvo}
                  className="w-full flex items-center gap-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-3.5 rounded-xl transition-colors text-left">
                  <Clock size={20} className="text-amber-400 shrink-0" /> Cerrado, vuelvo más tarde
                </button>
                <button data-testid="reparto-inc-definitivo" onClick={() => setDefDetail("")}
                  className="w-full flex items-center gap-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-3.5 rounded-xl transition-colors text-left">
                  <DoorClosed size={20} className="text-red-400 shrink-0" /> Cerrado definitivo
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 font-semibold">Detalle del cierre definitivo:</p>
                <textarea data-testid="reparto-inc-detail" value={defDetail} onChange={(e) => setDefDetail(e.target.value)} rows={3}
                  placeholder="Escribe el motivo/detalle..." className="w-full rounded-lg bg-slate-900 border border-slate-600 text-white text-sm p-3 outline-none focus:border-[#F26A21]" />
                <button data-testid="reparto-inc-definitivo-save" onClick={incDefinitivo} disabled={!defDetail.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                  Guardar y continuar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal ¿hubo incidencia? al terminar */}
      {endModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setEndModal(false)}>
          <div data-testid="reparto-end-modal" onClick={(e) => e.stopPropagation()} className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#F26A21]/15 border border-[#F26A21]/40 flex items-center justify-center shrink-0"><AlertTriangle size={20} className="text-[#F26A21]" /></div>
              <div className="flex-1"><h3 className="font-bold text-white">¿Hubo alguna incidencia?</h3><p className="text-sm text-slate-300 mt-0.5">En la entrega o recogida de esta parada.</p></div>
              <button onClick={() => setEndModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            {endDetail === null ? (
              <div className="flex gap-2">
                <button data-testid="reparto-end-no" onClick={endNo} className="flex-1 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl transition-colors">No, continuar</button>
                <button data-testid="reparto-end-si" onClick={endSi} className="flex-1 text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 py-3 rounded-xl transition-colors">Sí</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 font-semibold">Detalles de la incidencia:</p>
                <textarea data-testid="reparto-end-detail" value={endDetail} onChange={(e) => setEndDetail(e.target.value)} rows={3}
                  placeholder="Describe la incidencia..." className="w-full rounded-lg bg-slate-900 border border-slate-600 text-white text-sm p-3 outline-none focus:border-[#F26A21]" />
                <button data-testid="reparto-end-save" onClick={endGuardar} disabled={!endDetail.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                  Guardar y continuar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
