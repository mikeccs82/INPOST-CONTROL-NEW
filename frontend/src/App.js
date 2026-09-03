import { useState, useRef, useCallback, useEffect } from "react";
import { Toaster, toast } from "sonner";
import { motion } from "framer-motion";
import {
  Upload, Save, Download, FolderOpen, Route as RouteIcon, Zap,
  Clock, Ruler, MapPin, Loader2, Timer, Users,
} from "lucide-react";
import { MapView } from "./components/MapView";
import { StopList } from "./components/StopList";
import { AddStopPanel } from "./components/AddStopPanel";
import { WarehousePanel } from "./components/WarehousePanel";
import { StopInfoCard } from "./components/StopInfoCard";
import { UntypedMinutesModal } from "./components/UntypedMinutesModal";
import { GeocodeResolveDialog } from "./components/GeocodeResolveDialog";
import { SavedRoutesDialog } from "./components/SavedRoutesDialog";
import { DriversDialog } from "./components/DriversDialog";
import {
  importExcel, optimizeRoute, computeRoute, saveRoute, exportRoute,
  getSettings, saveSettings,
} from "./lib/api";
import { fmtDistance, fmtDuration } from "./lib/format";
import "./App.css";

const LOGO = "https://customer-assets-39nsmqrw.emergentagent.net/job_address-mapper-32/artifacts/wu9rybxe_LOGO%20NUEVO%20%282%29.jpeg";
const genId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));

function App() {
  const [stops, setStops] = useState([]);
  const [geometry, setGeometry] = useState(null);
  const [legs, setLegs] = useState(null);
  const [summary, setSummary] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [metric, setMetric] = useState("duration");
  const [importing, setImporting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [driversOpen, setDriversOpen] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [warehouse, setWarehouse] = useState({ start: null, end: null, sameAsStart: true, serviceByType: { P: 0, PD: 0, L: 0 }, untypedMin: 0, departureTime: "", respectWindows: true });
  const [pendingImport, setPendingImport] = useState([]);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [untypedModal, setUntypedModal] = useState({ open: false, count: 0 });
  const fileRef = useRef(null);

  useEffect(() => {
    getSettings()
      .then((s) => setWarehouse({
        start: s.start || null,
        end: s.end || null,
        sameAsStart: s.same_as_start ?? true,
        serviceByType: s.service_by_type || { P: 0, PD: 0, L: 0 },
        untypedMin: s.service_time_min ?? 0,
        departureTime: s.departure_time || "",
        respectWindows: s.respect_windows ?? true,
      }))
      .catch(() => {});
  }, []);

  const startWp = warehouse.start;
  const endWp = warehouse.sameAsStart ? null : warehouse.end;

  const serviceForStop = useCallback((s) => {
    const t = s.stop_type;
    const v = t ? Number(warehouse.serviceByType?.[t]) : Number(warehouse.untypedMin);
    return Number.isFinite(v) ? v : 0;
  }, [warehouse.serviceByType, warehouse.untypedMin]);

  const applyService = useCallback((arr) => arr.map((s) => ({ ...s, service_min: serviceForStop(s) })), [serviceForStop]);

  const meta = useCallback(() => ({
    start: warehouse.start,
    end: warehouse.sameAsStart ? null : warehouse.end,
    round_trip: warehouse.sameAsStart,
    service_time_min: 0,
    departure_time: warehouse.departureTime || null,
  }), [warehouse]);

  const applySchedule = (data) => {
    const m = {};
    (data.schedule || []).forEach((x) => { m[x.id] = x; });
    setSchedule(m);
  };

  const clearRoute = () => {
    setGeometry(null);
    setLegs(null);
    setSummary(null);
    setSchedule({});
    setSelectedId(null);
  };

  const recalc = useCallback(async (nextStops) => {
    const total = nextStops.length + (warehouse.start ? 1 : 0) + (endWp ? 1 : 0);
    if (total < 2) {
      clearRoute();
      return;
    }
    try {
      const data = await computeRoute(nextStops, meta());
      setGeometry(data.geometry);
      setLegs(data.legs);
      setSummary(data.summary);
      applySchedule(data);
    } catch (e) {
      toast.error("No se pudo calcular la ruta");
    }
  }, [meta, warehouse.start, endWp]);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    clearRoute();
    try {
      const data = await importExcel(file);
      const resolved = applyService(data.resolved.map((s) => ({ ...s, id: s.id || genId() })));
      setStops(resolved);
      const pend = data.pending.map((s) => ({ ...s, id: s.id || genId() }));
      setPendingImport(pend);
      toast.success(`${data.resolved_count} paradas importadas` + (data.pending_count ? ` · ${data.pending_count} por resolver` : ""));
      if (data.untyped_count > 0) setUntypedModal({ open: true, count: data.untyped_count });
      if (pend.length > 0) setResolveOpen(true);
    } catch (err) {
      toast.error("Error al importar el Excel");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const applyUntyped = (minutes) => {
    setWarehouse((w) => ({ ...w, untypedMin: minutes }));
    setStops((prev) => prev.map((s) => (s.stop_type ? s : { ...s, service_min: minutes })));
    setUntypedModal({ open: false, count: 0 });
  };

  const handleResolve = (newStops) => {
    const added = applyService(newStops.map((s) => ({ ...s, id: s.id || genId() })));
    setStops((prev) => [...prev, ...added]);
    setResolveOpen(false);
    setPendingImport([]);
    if (added.length) toast.success(`${added.length} parada(s) añadida(s)`);
  };

  const updateSummaryService = (arr) => {
    setSummary((prev) => {
      if (!prev || prev.drive_duration == null) return prev;
      const svc = arr.reduce((a, s) => a + (Number(s.service_min) || 0), 0) * 60;
      return { ...prev, service_duration: svc, duration: prev.drive_duration + svc };
    });
  };

  const changeType = (id, type) => {
    const next = stops.map((s) => {
      if (s.id !== id) return s;
      const ns = { ...s, stop_type: type || null };
      ns.service_min = serviceForStop(ns);
      return ns;
    });
    setStops(next);
    updateSummaryService(next);
  };

  const addStop = (partial) => {
    const s = { ...partial, id: genId(), stop_type: partial.stop_type || null };
    s.service_min = serviceForStop(s);
    setStops((prev) => [...prev, s]);
  };

  const removeStop = (id) => {
    const next = stops.filter((s) => s.id !== id);
    setStops(next);
    if (geometry) recalc(next);
  };

  const reorder = (from, to) => {
    const next = [...stops];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setStops(next);
    if (geometry) recalc(next);
  };

  const canOptimize = stops.length >= 2 || (stops.length >= 1 && !!warehouse.start);

  const handleOptimize = async () => {
    if (!canOptimize) {
      toast.error("Añade al menos 2 paradas (o 1 parada y el almacén)");
      return;
    }
    setOptimizing(true);
    try {
      const data = await optimizeRoute({ stops, metric, respect_windows: warehouse.respectWindows, ...meta() });
      const map = Object.fromEntries(stops.map((s) => [s.id, s]));
      const uniqueOrder = [...new Set(data.order)];
      const ordered = uniqueOrder.map((id) => map[id]).filter(Boolean);
      setStops(ordered);
      setGeometry(data.geometry);
      setLegs(data.legs);
      setSummary(data.summary);
      applySchedule(data);
      toast.success(data.used_windows ? "Ruta optimizada por horarios" : "Ruta optimizada");
    } catch (e) {
      toast.error("Error al optimizar la ruta");
    } finally {
      setOptimizing(false);
    }
  };

  const changeWindow = (id, from, to) => {
    const next = stops.map((s) => (s.id === id ? { ...s, window_from: from || null, window_to: to || null } : s));
    setStops(next);
    if (geometry) recalc(next);
  };

  const handleSaveSettings = async () => {
    try {
      const sbt = {
        P: Number(warehouse.serviceByType?.P) || 0,
        PD: Number(warehouse.serviceByType?.PD) || 0,
        L: Number(warehouse.serviceByType?.L) || 0,
      };
      await saveSettings({
        start: warehouse.start,
        end: warehouse.sameAsStart ? null : warehouse.end,
        same_as_start: warehouse.sameAsStart,
        service_by_type: sbt,
        service_time_min: Number(warehouse.untypedMin) || 0,
        departure_time: warehouse.departureTime || null,
        respect_windows: warehouse.respectWindows,
      });
      toast.success("Configuración guardada");
      const next = applyService(stops);
      setStops(next);
      updateSummaryService(next);
    } catch (e) {
      toast.error("Error al guardar la configuración");
    }
  };

  const handleSave = async () => {
    if (stops.length === 0) {
      toast.error("No hay paradas para guardar");
      return;
    }
    const name = routeName.trim() || `Ruta ${new Date().toLocaleDateString("es-ES")}`;
    try {
      await saveRoute({
        name, stops, metric, round_trip: warehouse.sameAsStart, depot_index: 0,
        start: warehouse.start, end: warehouse.sameAsStart ? null : warehouse.end,
        service_time_min: Number(warehouse.untypedMin) || 0,
      });
      toast.success("Ruta guardada");
      setRouteName("");
    } catch (e) {
      toast.error("Error al guardar");
    }
  };

  const handleExport = async () => {
    if (stops.length === 0) {
      toast.error("No hay paradas para exportar");
      return;
    }
    try {
      const blob = await exportRoute(stops);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ruta_boxlogic.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportado a Excel");
    } catch (e) {
      toast.error("Error al exportar");
    }
  };

  const handleLoad = (r) => {
    const parsed = r.stops.map((s) => ({ ...s, id: s.id || genId() }));
    setStops(parsed);
    setMetric(r.metric || "duration");
    setWarehouse((w) => ({
      ...w,
      start: r.start || null,
      end: r.end || null,
      sameAsStart: r.end ? false : true,
      untypedMin: r.service_time_min || 0,
    }));
    clearRoute();
    setSavedOpen(false);
    toast.success(`Ruta "${r.name}" cargada`);
    setTimeout(() => recalc(parsed), 150);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Toaster theme="dark" position="top-right" richColors />
      {/* Header */}
      <header className="h-16 shrink-0 bg-white border-b-2 border-[#F26A21] flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <img src={LOGO} alt="BoxLogic" className="h-11 w-auto" data-testid="brand-logo" />
          <div className="hidden sm:block border-l border-slate-200 pl-3">
            <p className="text-[11px] text-slate-500 uppercase tracking-[0.2em] font-semibold">Optimizador de rutas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" data-testid="file-input" />
          <button data-testid="import-btn" onClick={() => fileRef.current?.click()} disabled={importing}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#1E5AA8] hover:bg-[#184a8c] px-3 py-2 rounded-md transition-colors disabled:opacity-50">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar Excel
          </button>
          <button data-testid="open-drivers-btn" onClick={() => setDriversOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#F26A21] hover:bg-[#f58220] px-3 py-2 rounded-md transition-colors">
            <Users size={14} /> Conductores
          </button>
          <button data-testid="open-saved-btn" onClick={() => setSavedOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-black bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-md transition-colors">
            <FolderOpen size={14} /> Rutas
          </button>
          <button data-testid="export-btn" onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-black bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-md transition-colors">
            <Download size={14} /> Exportar
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-[400px] shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col min-h-0">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-px bg-slate-700 border-b border-slate-700">
            <Kpi icon={<MapPin size={14} />} label="Paradas" value={stops.length} />
            <Kpi icon={<Ruler size={14} />} label="Distancia" value={fmtDistance(summary?.distance)} />
            <Kpi icon={<Clock size={14} />} label="Tiempo" value={fmtDuration(summary?.duration)} />
          </div>
          {summary?.departure && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-[11px] font-mono-tech" data-testid="schedule-bar">
              <span className="text-slate-400">Salida <b className="text-emerald-400">{summary.departure}</b> → Fin <b className="text-sky-400">{summary.end_time}</b></span>
              {summary.late_count > 0 ? (
                <span className="text-red-400 font-bold">{summary.late_count} fuera de horario</span>
              ) : (
                <span className="text-emerald-400">Todo en horario</span>
              )}
            </div>
          )}

          {/* Scrollable middle */}
          <div className="flex-1 overflow-y-auto thin-scroll min-h-0">
          {/* Warehouse & settings */}
          <WarehousePanel warehouse={warehouse} onChange={setWarehouse} onSave={handleSaveSettings} />

          {/* Add panel */}
          <div className="p-3 border-b border-slate-800">
            <AddStopPanel onAdd={addStop} />
          </div>

          {/* Metric toggle */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex bg-slate-800 border border-slate-700 rounded-md p-0.5">
              <button data-testid="metric-duration" onClick={() => setMetric("duration")}
                className={`flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1.5 rounded transition-colors ${metric === "duration" ? "bg-[#F26A21] text-white" : "text-slate-400 hover:text-white"}`}>
                <Clock size={13} /> Más rápido
              </button>
              <button data-testid="metric-distance" onClick={() => setMetric("distance")}
                className={`flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1.5 rounded transition-colors ${metric === "distance" ? "bg-[#F26A21] text-white" : "text-slate-400 hover:text-white"}`}>
                <Ruler size={13} /> Más corto
              </button>
            </div>
            {summary?.service_duration > 0 && (
              <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1 font-mono-tech">
                <Timer size={11} /> Conducción {fmtDuration(summary.drive_duration)} + {fmtDuration(summary.service_duration)} en paradas
              </p>
            )}
          </div>

          {/* Stop list */}
          <div className="px-3 pb-2">
            <StopList stops={stops} onReorder={reorder} onRemove={removeStop} selectedId={selectedId} onSelect={setSelectedId} onChangeType={changeType} schedule={schedule} onChangeWindow={changeWindow} />
          </div>
          </div>

          {/* Save + Optimize */}
          <div className="p-3 border-t border-slate-700 space-y-2 bg-slate-900">
            <div className="flex gap-2">
              <input data-testid="route-name-input" value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Nombre de la ruta"
                className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21] placeholder:text-slate-500" />
              <button data-testid="save-btn" onClick={handleSave}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 rounded-md transition-colors">
                <Save size={14} /> Guardar
              </button>
            </div>
            <motion.button whileTap={{ scale: 0.98 }} data-testid="optimize-btn" onClick={handleOptimize} disabled={optimizing || !canOptimize}
              className="w-full flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-extrabold text-sm py-3 rounded-sm shadow-[2px_2px_0px_rgba(242,106,33,0.5)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {optimizing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
              {optimizing ? "Optimizando..." : "Optimizar ruta"}
            </motion.button>
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative min-w-0">
          <MapView stops={stops} geometry={geometry} legs={legs} start={startWp} end={endWp} selectedId={selectedId} onSelect={setSelectedId} />
          {selectedId && (
            <StopInfoCard
              stop={stops.find((s) => s.id === selectedId)}
              index={stops.findIndex((s) => s.id === selectedId)}
              total={stops.length}
              sched={schedule[selectedId]}
              onClose={() => setSelectedId(null)}
            />
          )}
          {stops.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
              <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-6 py-5 text-center max-w-sm">
                <RouteIcon size={32} className="mx-auto mb-3 text-[#F26A21]" />
                <p className="text-white font-semibold">Empieza a planificar tu ruta</p>
                <p className="text-slate-400 text-sm mt-1">Configura el almacén, importa un Excel o añade paradas en el panel de la izquierda.</p>
              </div>
            </div>
          )}
        </main>
      </div>

      <SavedRoutesDialog open={savedOpen} onClose={() => setSavedOpen(false)} onLoad={handleLoad} />
      <DriversDialog open={driversOpen} onClose={() => setDriversOpen(false)} />
      <UntypedMinutesModal
        open={untypedModal.open}
        count={untypedModal.count}
        initial={warehouse.untypedMin}
        onConfirm={applyUntyped}
        onCancel={() => setUntypedModal({ open: false, count: 0 })}
      />
      <GeocodeResolveDialog
        open={resolveOpen}
        pending={pendingImport}
        onConfirm={handleResolve}
        onClose={() => { setResolveOpen(false); setPendingImport([]); }}
      />
    </div>
  );
}

const Kpi = ({ icon, label, value }) => (
  <div className="bg-slate-900 px-3 py-2.5">
    <div className="flex items-center gap-1 text-slate-500 text-[10px] font-bold uppercase tracking-wider">{icon}{label}</div>
    <div className="text-white font-mono-tech font-semibold text-base mt-0.5 truncate" data-testid={`kpi-${label.toLowerCase()}`}>{value}</div>
  </div>
);

export default App;
