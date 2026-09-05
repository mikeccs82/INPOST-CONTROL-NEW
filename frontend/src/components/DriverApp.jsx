import { useEffect, useState, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { LogOut, Truck, ArrowLeft, PackageCheck, Loader2, ArrowRight } from "lucide-react";
import { MapView } from "./MapView";
import { StopList } from "./StopList";
import { DriverDashboard } from "./DriverDashboard";
import { RouteStopsView } from "./RouteStopsView";
import { SacasSort } from "./SacasSort";
import { myRouteConfig, saveDriverRouteOrder, computeRoute } from "../lib/api";
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

  const metaOf = (r) => ({ start: r?.start || null, end: r?.end || null, round_trip: r?.round_trip ?? true, departure_time: r?.departure_time || null });

  const draw = useCallback(async (sts, r) => {
    const total = sts.length + (r?.start ? 1 : 0) + (r?.end ? 1 : 0);
    if (total < 2) { setGeometry(null); setLegs(null); setSummary(null); return; }
    try { const d = await computeRoute(sts, metaOf(r)); setGeometry(d.geometry); setLegs(d.legs); setSummary(d.summary); }
    catch (e) { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    setRouteLoading(true);
    try {
      const r = await myRouteConfig();
      setRouteNumber(r.route_number);
      setAllStops(r.stops || []);
      setDriverRoute(r.driver_route || null);
      const sts = (r.driver_route?.stops || []).map((s) => ({ ...s }));
      setStops(sts);
      if (r.driver_route) draw(sts, r.driver_route);
    } catch (e) { toast.error("No se pudo cargar tu ruta"); }
    finally { setRouteLoading(false); }
  }, [draw]);

  useEffect(() => { load(); }, [load]);

  const openRoute = () => { load(); setScreen("route"); };

  const reorder = async (from, to) => {
    const next = [...stops];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setStops(next);
    draw(next, driverRoute);
    try { await saveDriverRouteOrder(next); } catch (e) { toast.error("No se pudo guardar el orden"); }
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
          onSoon={(label) => toast.info(`${label}: Próximamente`)}
          onLogout={onLogout}
        />
      )}

      {screen === "sacas" && <SacasSort onNext={openRoute} />}

      {screen === "carga" && (
        <div data-testid="carga-view" className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-slate-950">
          <div className="w-16 h-16 rounded-2xl bg-[#2563EB]/15 border border-[#2563EB]/40 flex items-center justify-center mb-4">
            <Truck size={32} className="text-[#2563EB]" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Carga del vehículo</h1>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2563EB] mb-3">Paso 3</p>
          <p className="text-slate-400 text-sm">Próximamente</p>
        </div>
      )}

      {screen === "paradas" && (
        <RouteStopsView stops={allStops} routeName={routeNumber ? `Ruta ${routeNumber}` : null} />
      )}

      {screen === "route" && (
        <>
          <div className="shrink-0 bg-slate-950 border-b border-slate-800 px-3 py-2 flex items-center gap-2">
            <PackageCheck size={15} className="text-[#F26A21]" />
            <span className="text-xs text-slate-300">{stops.length} paradas ordenadas</span>
            {summary && <span className="text-[11px] font-mono-tech text-slate-300">{fmtDistance(summary.distance)} · {fmtDuration(summary.duration)}</span>}
            {driverRoute && (
              <button data-testid="route-next-step" onClick={() => setScreen("carga")}
                className="ml-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors">
                Siguiente <ArrowRight size={14} />
              </button>
            )}
          </div>

          {routeLoading ? (
            <div className="flex-1 flex items-center justify-center bg-slate-950">
              <Loader2 className="animate-spin text-[#F26A21]" />
            </div>
          ) : !driverRoute ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-slate-950">
              <PackageCheck size={40} className="text-slate-600 mb-3" />
              <p className="text-slate-300 font-semibold mb-1">Aún no has preparado la ruta</p>
              <p className="text-slate-500 text-sm mb-4">Ve a "Ordenar Sacas", registra las paradas que te salieron y pulsa "Siguiente paso" para generar tu ruta optimizada.</p>
              <button data-testid="go-sacas-btn" onClick={() => setScreen("sacas")} className="bg-[#F26A21] hover:bg-[#f58220] text-white font-bold px-5 py-2.5 rounded-lg transition-colors">Ir a Ordenar Sacas</button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
              <div className="h-[45vh] md:h-auto md:flex-1 min-h-0 relative order-1 md:order-2">
                <MapView stops={stops} geometry={geometry} legs={legs} start={driverRoute?.start || null} end={driverRoute?.end || null} selectedId={selectedId} onSelect={setSelectedId} />
              </div>
              <div className="flex-1 md:flex-none md:w-[380px] overflow-y-auto thin-scroll p-3 bg-slate-900 border-t md:border-t-0 md:border-r border-slate-700 order-2 md:order-1 min-h-0">
                <StopList stops={stops} onReorder={reorder} onRemove={() => {}} selectedId={selectedId} onSelect={setSelectedId} onChangeType={() => {}} schedule={{}} onChangeWindow={() => {}} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
