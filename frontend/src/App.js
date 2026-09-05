import { useState, useRef, useCallback, useEffect } from "react";
import { Toaster, toast } from "sonner";
import { motion } from "framer-motion";
import {
  Upload, Save, Download, FolderOpen, Route as RouteIcon, Zap,
  Clock, Ruler, MapPin, Loader2, Timer, Users, RotateCcw, LogOut, Send, ArrowLeft,
  FlaskConical, ChevronRight, X, CheckCircle2,
} from "lucide-react";
import { MapView } from "./components/MapView";
import { StopList } from "./components/StopList";
import { AddStopPanel } from "./components/AddStopPanel";
import { WarehousePanel } from "./components/WarehousePanel";
import { StopInfoCard } from "./components/StopInfoCard";
import { UntypedMinutesModal } from "./components/UntypedMinutesModal";
import { GeocodeResolveDialog } from "./components/GeocodeResolveDialog";
import { SavedRoutesDialog } from "./components/SavedRoutesDialog";
import { UsersDialog } from "./components/UsersDialog";
import { ExportNameModal } from "./components/ExportNameModal";
import {
  importExcel, optimizeRoute, computeRoute, saveRoute, exportRoute,
  getSettings, saveSettings, listRouteConfigs, getRouteConfig, saveSimulation,
} from "./lib/api";
import { fmtDistance, fmtDuration } from "./lib/format";
import "./App.css";

const LOGO = "https://customer-assets-39nsmqrw.emergentagent.net/job_address-mapper-32/artifacts/wu9rybxe_LOGO%20NUEVO%20%282%29.jpeg";
const genId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));

function App({ user, onLogout, onBack }) {
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
  const [exportOpen, setExportOpen] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [warehouse, setWarehouse] = useState({ start: null, end: null, sameAsStart: true, serviceByType: { P: 0, PD: 0, L: 0 }, untypedMin: 0, departureTime: "", respectWindows: true });
  const [pendingImport, setPendingImport] = useState([]);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [untypedModal, setUntypedModal] = useState({ open: false, count: 0 });
  const [simMode, setSimMode] = useState(null); // null=gate, 'route', 'free'
  const [targetRoute, setTargetRoute] = useState(null); // {id, number}
  const [routeConfigs, setRouteConfigs] = useState([]);
  const [gateLoading, setGateLoading] = useState(false);
  const [assignSimOpen, setAssignSimOpen] = useState(false);
  const [assigningSim, setAssigningSim] = useState(false);
  const fileRef = useRef(null);

  const loadRouteConfigs = useCallback(() => {
    listRouteConfigs().then(setRouteConfigs).catch(() => {});
  }, []);
  useEffect(() => { loadRouteConfigs(); }, [loadRouteConfigs]);

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

  const handleReset = () => {
    setStops([]);
    clearRoute();
    setPendingImport([]);
    setResolveOpen(false);
    setUntypedModal({ open: false, count: 0 });
    setRouteName("");
    toast.success("Reiniciado");
  };

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

  const doExport = async (fname) => {
    if (stops.length === 0) { toast.error("No hay paradas para exportar"); return; }
    try {
      const blob = await exportRoute(stops);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fname || "ruta"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
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

  const chooseRouteToSim = async (id) => {
    if (!id) return;
    setGateLoading(true);
    try {
      const r = await getRouteConfig(id);
      const loaded = applyService((r.stops || []).map((s) => ({ ...s, id: s.id || genId() })));
      setStops(loaded);
      setTargetRoute({ id: r.id, number: r.number });
      setSimMode("route");
      clearRoute();
      if (loaded.length === 0) toast.info("Esta ruta no tiene paradas. Importa un Excel para simular.");
    } catch (e) {
      toast.error("No se pudo cargar la ruta");
    } finally {
      setGateLoading(false);
    }
  };

  const startFreeSim = () => {
    setStops([]);
    clearRoute();
    setTargetRoute(null);
    setSimMode("free");
  };

  const backToGate = () => {
    handleReset();
    setSimMode(null);
    setTargetRoute(null);
    loadRouteConfigs();
  };

  const assignSimTo = async (routeId) => {
    if (!routeId || stops.length === 0) return;
    setAssigningSim(true);
    try {
      await saveSimulation(routeId, { stops, summary });
      toast.success("Simulación asignada a la ruta");
      setAssignSimOpen(false);
      loadRouteConfigs();
    } catch (e) {
      toast.error("No se pudo asignar la simulación");
    } finally {
      setAssigningSim(false);
    }
  };

  const handleAssignSim = () => {
    if (targetRoute) assignSimTo(targetRoute.id);
    else setAssignSimOpen(true);
  };

  if (simMode === null) {
    return (
      <SimGate
        routes={routeConfigs}
        loading={gateLoading}
        onChoose={chooseRouteToSim}
        onFree={startFreeSim}
        onBack={onBack}
        adminName={user?.nombres || user?.username}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Toaster theme="dark" position="top-right" richColors />
      {/* Header */}
      <header className="min-h-16 shrink-0 bg-white border-b-2 border-[#F26A21] flex flex-wrap items-center justify-between gap-y-2 px-3 md:px-4 py-2 z-20">
        <div className="flex items-center gap-3">
          {onBack && (
            <button data-testid="sim-back-btn" onClick={onBack} title="Volver al panel"
              className="flex items-center justify-center w-9 h-9 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700">
              <ArrowLeft size={18} />
            </button>
          )}
          <img src={LOGO} alt="BoxLogic" className="h-11 w-auto" data-testid="brand-logo" />
          <div className="hidden sm:block border-l border-slate-200 pl-3">
            <p className="text-[11px] text-slate-500 uppercase tracking-[0.2em] font-semibold">Simulación de ruta</p>
          </div>
          <button data-testid="sim-change-route" onClick={backToGate}
            className="flex items-center gap-1.5 text-xs font-bold text-[#F26A21] bg-[#F26A21]/10 hover:bg-[#F26A21]/20 border border-[#F26A21]/30 px-3 py-1.5 rounded-md transition-colors">
            <FlaskConical size={13} /> {targetRoute ? `Ruta ${targetRoute.number}` : "Simulación libre"}
            <ChevronRight size={13} className="opacity-60" />
          </button>
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
          <button data-testid="export-btn" onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-black bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-md transition-colors">
            <Download size={14} /> Exportar
          </button>
          <button data-testid="reset-btn" onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-white hover:bg-red-500 bg-red-50 border border-red-200 px-3 py-2 rounded-md transition-colors">
            <RotateCcw size={14} /> Reiniciar
          </button>
          <span className="hidden md:inline text-xs text-slate-400 font-mono-tech ml-1">{user?.nombres || user?.username}</span>
          <button data-testid="logout-btn" onClick={onLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-white hover:bg-slate-700 bg-slate-100 border border-slate-200 px-3 py-2 rounded-md transition-colors">
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-full md:w-[400px] md:shrink-0 h-[52vh] md:h-auto bg-slate-900 border-r border-slate-700 flex flex-col min-h-0">
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
            <button data-testid="assign-sim-btn" onClick={handleAssignSim} disabled={stops.length === 0 || !summary || assigningSim}
              className="w-full flex items-center justify-center gap-2 bg-[#1E5AA8] hover:bg-[#184a8c] text-white font-bold text-sm py-2.5 rounded-sm transition-colors disabled:opacity-40">
              {assigningSim ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {targetRoute ? `Asignar simulación a Ruta ${targetRoute.number}` : "Asignar simulación a la ruta"}
            </button>
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
      <UsersDialog open={driversOpen} onClose={() => setDriversOpen(false)} />
      <ExportNameModal
        open={exportOpen}
        defaultName={`Ruta-02-${new Date().toLocaleDateString("es-ES").replace(/\//g, "-")}`}
        onConfirm={doExport}
        onCancel={() => setExportOpen(false)}
      />
      <AssignSimModal
        open={assignSimOpen}
        routes={routeConfigs}
        stopsCount={stops.length}
        summary={summary}
        assigning={assigningSim}
        onAssign={assignSimTo}
        onClose={() => setAssignSimOpen(false)}
      />
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

const SimGate = ({ routes, loading, onChoose, onFree, onBack, adminName }) => {
  const [sel, setSel] = useState("");
  return (
    <div data-testid="sim-gate" className="h-screen w-screen flex flex-col bg-slate-950">
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-3">
        <div className="flex items-center gap-2 min-w-0">
          <button data-testid="sim-gate-back" onClick={onBack} className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-md flex items-center justify-center text-slate-200"><ArrowLeft size={17} /></button>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm">Simulación de ruta</div>
            <div className="text-[10px] text-slate-400 truncate">{adminName}</div>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto thin-scroll p-4 flex items-start justify-center">
        <div className="w-full max-w-md mt-6">
          <div className="w-14 h-14 rounded-2xl bg-[#F26A21]/15 border border-[#F26A21]/40 flex items-center justify-center mb-4">
            <FlaskConical size={28} className="text-[#F26A21]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">¿Qué ruta vas a simular?</h1>
          <p className="text-sm text-slate-400 mb-6">Elige una ruta existente para cargar sus paradas, o simula libremente importando un Excel.</p>

          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-4">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Ruta existente</label>
            <select data-testid="sim-gate-select" value={sel} onChange={(e) => setSel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#F26A21] mb-3">
              <option value="">— Selecciona una ruta —</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  Ruta {r.number || "—"}{r.driver ? ` · ${r.driver.nombres} ${r.driver.apellidos}`.trimEnd() : ""} · {r.stops_count || 0} paradas
                </option>
              ))}
            </select>
            <button data-testid="sim-gate-load" onClick={() => onChoose(sel)} disabled={!sel || loading}
              className="w-full flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-3 rounded-md transition-colors disabled:opacity-40">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Cargar paradas y simular
            </button>
            {routes.length === 0 && <p className="text-[11px] text-slate-500 mt-2">No hay rutas creadas todavía. Créalas en "Configuración de rutas".</p>}
          </div>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-700" /><span className="text-xs text-slate-500 font-semibold">o</span><div className="flex-1 h-px bg-slate-700" />
          </div>

          <button data-testid="sim-gate-free" onClick={onFree}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-3 rounded-md transition-colors">
            <Upload size={16} /> Simular libre (importar Excel)
          </button>
        </div>
      </div>
    </div>
  );
};

const AssignSimModal = ({ open, routes, stopsCount, summary, assigning, onAssign, onClose }) => {
  const [sel, setSel] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div data-testid="assign-sim-modal" onClick={(e) => e.stopPropagation()} className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-bold text-white flex items-center gap-2"><CheckCircle2 size={18} className="text-[#F26A21]" /> Asignar simulación</h3>
          <button data-testid="assign-sim-close" onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-400">Se guardará esta simulación ({stopsCount} paradas{summary ? `, ${fmtDistance(summary.distance)} · ${fmtDuration(summary.duration)}` : ""}) como estimación en la ruta que elijas. No cambia el orden que gestiona el conductor.</p>
          <select data-testid="assign-sim-select" value={sel} onChange={(e) => setSel(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21]">
            <option value="">— Selecciona la ruta destino —</option>
            {routes.map((r) => <option key={r.id} value={r.id}>Ruta {r.number || "—"}{r.driver ? ` · ${r.driver.nombres} ${r.driver.apellidos}`.trimEnd() : ""}</option>)}
          </select>
          <button data-testid="assign-sim-confirm" onClick={() => onAssign(sel)} disabled={!sel || assigning}
            className="w-full flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-2.5 rounded-md transition-colors disabled:opacity-40">
            {assigning ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Asignar a esta ruta
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
