import { useEffect, useState, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { LogOut, Truck, ArrowLeft, PackageCheck, Loader2, ArrowRight, Wand2, RotateCcw, Warehouse } from "lucide-react";
import { MapView } from "./MapView";
import { StopList } from "./StopList";
import { DriverDashboard } from "./DriverDashboard";
import { RouteStopsView } from "./RouteStopsView";
import { SacasSort } from "./SacasSort";
import { CargaVehiculo } from "./CargaVehiculo";
import { CargaOrden } from "./CargaOrden";
import { CargaLista } from "./CargaLista";
import { RepartoView } from "./RepartoView";
import { DayBar } from "./DayBar";
import { PreCargaModal } from "./PreCargaModal";
import { myRouteConfig, saveDriverRouteOrder, computeRoute, buildMyRoute, repeatLastSacas } from "../lib/api";
import { fmtDistance, fmtDuration } from "../lib/format";
import "../App.css";

export const DriverApp = ({ user, onLogout }) => {
  const [routeNumber, setRouteNumber] = useState(null);
  const [allStops, setAllStops] = useState([]);
  const [driverRoute, setDriverRoute] = useState(null); // {stops, start, end, round_trip, departure_time, summary}
  const [stops, setStops] = useState([]);
  const [geometry, setGeometry] = useState(null);
  const [legs, setLegs] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const [routeLoading, setRouteLoading] = useState(true);
  const [rDate, setRDate] = useState(null);
  const [rToday, setRToday] = useState(null);
  const [rEditable, setREditable] = useState(true);
  const [rDates, setRDates] = useState([]);

  const metaOf = (r) => ({ start: r?.start || null, end: r?.end || null, round_trip: r?.round_trip ?? true, departure_time: r?.departure_time || null });

  const draw = useCallback(async (sts, r) => {
    const total = sts.length + (r?.start ? 1 : 0) + (r?.end ? 1 : 0);
    if (total < 2) { setGeometry(null); setLegs(null); setSummary(null); return; }
    try { const d = await computeRoute(sts, metaOf(r)); setGeometry(d.geometry); setLegs(d.legs); setSummary(d.summary); }
    catch (e) { /* ignore */ }
  }, []);

  const load = useCallback(async (d) => {
    setRouteLoading(true);
    try {
      const r = await myRouteConfig(d);
      setRouteNumber(r.route_number);
      setAllStops(r.stops || []);
      setDriverRoute(r.driver_route || null);
      const sts = (r.driver_route?.stops || []).map((s) => ({ ...s }));
      setStops(sts);
      setRDate(r.date); setRToday(r.today); setREditable(!!r.editable); setRDates(r.dates || []);
      if (r.driver_route) draw(sts, r.driver_route);
      else { setGeometry(null); setLegs(null); setSummary(null); }
    } catch (e) { toast.error("No se pudo cargar tu ruta"); }
    finally { setRouteLoading(false); }
  }, [draw]);

  useEffect(() => { load(); }, [load]);

  const openRoute = () => { load(); setScreen("route"); };

  const reorder = async (from, to) => {
    if (!rEditable) { toast.error("Los días anteriores son solo lectura"); return; }
    const next = [...stops];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setStops(next);
    draw(next, driverRoute);
    try { await saveDriverRouteOrder(next); } catch (e) { toast.error("No se pudo guardar el orden"); }
  };

  const [building, setBuilding] = useState(false);
  const [preCargaOpen, setPreCargaOpen] = useState(false);
  const [preCargaSaving, setPreCargaSaving] = useState(false);

  const routeStopIds = new Set((driverRoute?.stops || []).map((s) => s.id));
  const unscannedStops = (allStops || []).filter((s) => !routeStopIds.has(s.id));

  const confirmPreCarga = async (selected) => {
    setPreCargaSaving(true);
    try {
      if (selected.length > 0) {
        const added = selected.map((s) => ({ ...s, pickup_only: true, added_manual: true }));
        const next = [...(driverRoute?.stops || []), ...added];
        await saveDriverRouteOrder(next);
      }
      setPreCargaOpen(false);
      await load();
      setScreen("carga");
    } catch (e) {
      toast.error("No se pudieron añadir las recogidas");
    } finally { setPreCargaSaving(false); }
  };

  const optimize = async () => {
    if (!rEditable) { toast.error("Los días anteriores son solo lectura"); return; }
    setBuilding(true);
    try {
      await buildMyRoute();
      await load();
      toast.success("Ruta optimizada");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo optimizar. ¿Ordenaste sacas?");
    } finally { setBuilding(false); }
  };
  const repeatLast = async () => {
    if (!rEditable) { toast.error("Los días anteriores son solo lectura"); return; }
    setBuilding(true);
    try {
      const r = await repeatLastSacas();
      await buildMyRoute();
      await load();
      toast.success(`Repetido el último día: ${r.count} paradas`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo repetir el último día");
    } finally { setBuilding(false); }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Toaster theme="dark" position="top-center" richColors />
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-3 z-20">
        <div className="flex items-center gap-2 min-w-0">
          {screen !== "dashboard" ? (
            <button data-testid="back-to-dashboard" onClick={() => setScreen("dashboard")} className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-md flex items-center justify-center shrink-0 text-slate-200"><ArrowLeft size={17} /></button>
          ) : (
            <div className="w-8 h-8 bg-[#F26A21] rounded-md flex items-center justify-center shrink-0"><Truck size={17} className="text-white" /></div>
          )}
          <div className="min-w-0">
            <div className="text-white font-bold text-sm truncate">{user.nombres} {user.apellidos}</div>
            <div className="text-[10px] text-slate-400 truncate">{routeNumber ? `Ruta ${routeNumber}` : "Sin ruta"} {user.matricula ? `· ${user.matricula}` : ""}</div>
          </div>
        </div>
        <button data-testid="driver-logout" onClick={onLogout} className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-md"><LogOut size={14} /> Salir</button>
      </header>

      {screen === "dashboard" && (
        <DriverDashboard
          onOpenRoute={() => setScreen("route")}
          onOpenParadas={() => setScreen("paradas")}
          onOpenSacas={() => setScreen("sacas")}
          onOpenCarga={() => setScreen("carga")}
          onOpenReparto={() => setScreen("reparto")}
          onSoon={(label) => toast.info(`${label}: Próximamente`)}
          onLogout={onLogout}
        />
      )}

      {screen === "sacas" && <SacasSort onNext={openRoute} />}

      {screen === "carga" && <CargaVehiculo onNext={() => setScreen("carga-orden")} />}

      {screen === "carga-orden" && <CargaOrden count={stops.length} onNext={() => setScreen("carga-lista")} />}

      {screen === "carga-lista" && <CargaLista onFinish={() => { load(); setScreen("reparto"); }} />}

      {screen === "reparto" && <RepartoView />}

      {screen === "paradas" && (
        <RouteStopsView stops={allStops} routeName={routeNumber ? `Ruta ${routeNumber}` : null} />
      )}

      {screen === "route" && (
        <>
          <DayBar date={rDate} today={rToday} editable={rEditable} dates={rDates} onChange={load} />
          <div className="shrink-0 bg-slate-950 border-b border-slate-800 px-3 py-2 flex items-center gap-2">
            <PackageCheck size={15} className="text-[#F26A21]" />
            <span className="text-xs text-slate-300">{stops.length} paradas ordenadas</span>
            {summary && <span className="text-[11px] font-mono-tech text-slate-300">{fmtDistance(summary.distance)} · {fmtDuration(summary.duration)}</span>}
            {rEditable && (
              <div className="ml-auto flex items-center gap-1.5">
                <button data-testid="route-repeat-last" onClick={repeatLast} disabled={building}
                  className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 hover:border-[#F26A21] text-white text-xs font-bold px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50">
                  <RotateCcw size={13} /> Repetir último día
                </button>
                <button data-testid="route-optimize" onClick={optimize} disabled={building}
                  className="flex items-center gap-1.5 bg-[#1E5AA8] hover:bg-[#184a8c] text-white text-xs font-bold px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50">
                  {building ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Optimizar
                </button>
                {driverRoute && (
                  <button data-testid="route-next-step" onClick={() => setPreCargaOpen(true)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors">
                    Siguiente <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          {!rEditable && (
            <div className="shrink-0 bg-slate-800/60 border-b border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 flex items-center gap-1.5">
              Estás viendo un día anterior · no se puede reordenar
            </div>
          )}

          {routeLoading ? (
            <div className="flex-1 flex items-center justify-center bg-slate-950">
              <Loader2 className="animate-spin text-[#F26A21]" />
            </div>
          ) : !driverRoute ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-slate-950">
              <PackageCheck size={40} className="text-slate-600 mb-3" />
              <p className="text-slate-300 font-semibold mb-1">Aún no has preparado la ruta</p>
              <p className="text-slate-500 text-sm mb-4">Ordena las sacas y pulsa <b>Optimizar</b>, o trae las paradas de ayer con <b>Repetir último día</b>.</p>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button data-testid="go-sacas-btn" onClick={() => setScreen("sacas")} className="bg-[#F26A21] hover:bg-[#f58220] text-white font-bold px-5 py-2.5 rounded-lg transition-colors">Ir a Ordenar Sacas</button>
                {rEditable && (
                  <>
                    <button data-testid="empty-optimize" onClick={optimize} disabled={building} className="flex items-center gap-1.5 bg-[#1E5AA8] hover:bg-[#184a8c] text-white font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50">
                      {building ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Optimizar
                    </button>
                    <button data-testid="empty-repeat-last" onClick={repeatLast} disabled={building} className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 hover:border-[#F26A21] text-white font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50">
                      <RotateCcw size={15} /> Repetir último día
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
              <div className="h-[45vh] md:h-auto md:flex-1 min-h-0 relative order-1 md:order-2">
                <MapView stops={stops} geometry={geometry} legs={legs} start={driverRoute?.start || null} end={driverRoute?.end || null} selectedId={selectedId} onSelect={setSelectedId} />
              </div>
              <div className="flex-1 md:flex-none md:w-[380px] overflow-y-auto thin-scroll p-3 bg-slate-900 border-t md:border-t-0 md:border-r border-slate-700 order-2 md:order-1 min-h-0">
                {driverRoute?.start && (
                  <div data-testid="route-nave-start" className="mb-2 flex items-center gap-2.5 rounded-md bg-emerald-600/10 border border-emerald-500/40 px-3 py-2">
                    <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center shrink-0"><Warehouse size={15} className="text-white" /></div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Salida · Nave</div>
                      <div className="text-xs text-white truncate">{driverRoute.start.address || driverRoute.start.name}</div>
                    </div>
                  </div>
                )}
                <StopList stops={stops} onReorder={reorder} onRemove={() => {}} selectedId={selectedId} onSelect={setSelectedId} onChangeType={() => {}} schedule={{}} onChangeWindow={() => {}} readOnlyMeta={true} />
                {(driverRoute?.round_trip || driverRoute?.end) && (
                  <div data-testid="route-nave-end" className="mt-1 flex items-center gap-2.5 rounded-md bg-sky-600/10 border border-sky-500/40 px-3 py-2">
                    <div className="w-7 h-7 rounded-md bg-sky-600 flex items-center justify-center shrink-0"><Warehouse size={15} className="text-white" /></div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Retorno · Nave</div>
                      <div className="text-xs text-white truncate">{(driverRoute.end || driverRoute.start)?.address || (driverRoute.end || driverRoute.start)?.name}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {preCargaOpen && (
        <PreCargaModal
          unscanned={unscannedStops}
          saving={preCargaSaving}
          onCancel={() => setPreCargaOpen(false)}
          onConfirm={confirmPreCarga}
        />
      )}
    </div>
  );
};
