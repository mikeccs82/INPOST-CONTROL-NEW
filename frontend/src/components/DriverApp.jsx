import { useEffect, useState, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { LogOut, Truck, Lock, CalendarDays, ArrowLeft } from "lucide-react";
import { MapView } from "./MapView";
import { StopList } from "./StopList";
import { DriverDashboard } from "./DriverDashboard";
import { RouteStopsView } from "./RouteStopsView";
import { myRoute, myDates, updateMyOrder, computeRoute } from "../lib/api";
import { fmtDistance, fmtDuration } from "../lib/format";
import "../App.css";

const today = () => new Date().toISOString().slice(0, 10);

export const DriverApp = ({ user, onLogout }) => {
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState(today());
  const [asg, setAsg] = useState(null);
  const [stops, setStops] = useState([]);
  const [geometry, setGeometry] = useState(null);
  const [legs, setLegs] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const isToday = date === today();

  const metaOf = (a) => ({ start: a?.start || null, end: a?.end || null, round_trip: a?.round_trip ?? true, departure_time: a?.departure_time || null });

  const draw = useCallback(async (sts, a) => {
    const total = sts.length + (a?.start ? 1 : 0) + (a?.end ? 1 : 0);
    if (total < 2) { setGeometry(null); setLegs(null); setSummary(null); return; }
    try { const d = await computeRoute(sts, metaOf(a)); setGeometry(d.geometry); setLegs(d.legs); setSummary(d.summary); }
    catch (e) { /* ignore */ }
  }, []);

  const load = useCallback(async (d) => {
    try {
      const r = await myRoute(d);
      setAsg(r.assignment);
      const sts = (r.assignment?.stops || []).map((s) => ({ ...s }));
      setStops(sts);
      draw(sts, r.assignment);
    } catch (e) { toast.error("No se pudo cargar la ruta"); }
  }, [draw]);

  useEffect(() => { myDates().then(setDates).catch(() => {}); }, []);
  useEffect(() => { load(date); }, [date, load]);

  const reorder = async (from, to) => {
    if (!isToday) { toast.info("Solo puedes reordenar la ruta de hoy"); return; }
    const next = [...stops];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setStops(next);
    draw(next, asg);
    try { await updateMyOrder(date, next); } catch (e) { toast.error("No se pudo guardar el orden"); }
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
            <div className="text-[10px] text-slate-400 truncate">{asg?.name || "Sin ruta"} {user.matricula ? `· ${user.matricula}` : ""}</div>
          </div>
        </div>
        <button data-testid="driver-logout" onClick={onLogout} className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-md"><LogOut size={14} /> Salir</button>
      </header>

      {screen === "dashboard" && (
        <DriverDashboard
          onOpenRoute={() => setScreen("route")}
          onOpenParadas={() => setScreen("paradas")}
          onSoon={(label) => toast.info(`${label}: Próximamente`)}
          onLogout={onLogout}
        />
      )}

      {screen === "paradas" && (
        <RouteStopsView stops={asg?.stops || []} routeName={asg?.name} />
      )}

      {screen === "route" && (
        <>
          <div className="shrink-0 bg-slate-950 border-b border-slate-800 px-3 py-2 flex items-center gap-2">
            <CalendarDays size={15} className="text-[#F26A21]" />
            <select data-testid="driver-date" value={date} onChange={(e) => setDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#F26A21]">
              <option value={today()}>Hoy ({today()})</option>
              {dates.filter((d) => d.date !== today()).map((d) => <option key={d.date} value={d.date}>{d.date} · {d.name || "Ruta"}</option>)}
            </select>
            {!isToday && <span className="flex items-center gap-1 text-[11px] text-amber-400"><Lock size={12} /> Solo lectura</span>}
            {summary && <span className="ml-auto text-[11px] font-mono-tech text-slate-300">{fmtDistance(summary.distance)} · {fmtDuration(summary.duration)}</span>}
          </div>

          <div className="flex-1 flex flex-col md:flex-row min-h-0">
            <div className="h-[45vh] md:h-auto md:flex-1 min-h-0 relative order-1 md:order-2">
              <MapView stops={stops} geometry={geometry} legs={legs} start={asg?.start || null} end={asg?.end || null} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            <div className="flex-1 md:flex-none md:w-[380px] overflow-y-auto thin-scroll p-3 bg-slate-900 border-t md:border-t-0 md:border-r border-slate-700 order-2 md:order-1 min-h-0">
              {stops.length === 0
                ? <p className="text-slate-500 text-sm text-center py-10">No tienes ruta para esta fecha.</p>
                : <StopList stops={stops} onReorder={reorder} onRemove={() => {}} selectedId={selectedId} onSelect={setSelectedId} onChangeType={() => {}} schedule={{}} onChangeWindow={() => {}} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
