import { useState, useRef, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { motion } from "framer-motion";
import {
  Upload, Save, Download, FolderOpen, Route as RouteIcon, Zap,
  Clock, Ruler, MapPin, Loader2, RefreshCw, Truck,
} from "lucide-react";
import { MapView } from "./components/MapView";
import { StopList } from "./components/StopList";
import { AddStopPanel } from "./components/AddStopPanel";
import { SavedRoutesDialog } from "./components/SavedRoutesDialog";
import {
  importExcel, optimizeRoute, computeRoute, saveRoute, exportRoute,
} from "./lib/api";
import { fmtDistance, fmtDuration } from "./lib/format";
import "./App.css";

const genId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));

function App() {
  const [stops, setStops] = useState([]);
  const [geometry, setGeometry] = useState(null);
  const [summary, setSummary] = useState(null);
  const [metric, setMetric] = useState("duration");
  const [roundTrip, setRoundTrip] = useState(true);
  const [importing, setImporting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const fileRef = useRef(null);
  const [routeName, setRouteName] = useState("");

  const clearRoute = () => {
    setGeometry(null);
    setSummary(null);
  };

  const recalc = useCallback(async (nextStops) => {
    if (nextStops.length < 2) {
      clearRoute();
      return;
    }
    try {
      const data = await computeRoute(nextStops);
      setGeometry(data.geometry);
      setSummary(data.summary);
    } catch (e) {
      toast.error("No se pudo calcular la ruta");
    }
  }, []);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    clearRoute();
    try {
      const data = await importExcel(file);
      const parsed = data.stops.map((s) => ({ ...s, id: s.id || genId() }));
      setStops(parsed);
      toast.success(`${parsed.length} paradas importadas` + (data.geocoded ? ` · ${data.geocoded} geocodificadas` : "") + (data.skipped ? ` · ${data.skipped} omitidas` : ""));
    } catch (err) {
      toast.error("Error al importar el Excel");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addStop = (partial) => {
    setStops((prev) => [...prev, { ...partial, id: genId() }]);
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

  const setDepot = (index) => {
    const next = [...stops];
    const [moved] = next.splice(index, 1);
    next.unshift(moved);
    setStops(next);
    if (geometry) recalc(next);
    toast.success("Depósito actualizado");
  };

  const handleOptimize = async () => {
    if (stops.length < 2) {
      toast.error("Añade al menos 2 paradas");
      return;
    }
    setOptimizing(true);
    try {
      const data = await optimizeRoute({ stops, depot_index: 0, metric, round_trip: roundTrip });
      const map = Object.fromEntries(stops.map((s) => [s.id, s]));
      const ordered = data.order.map((id) => map[id]);
      setStops(ordered);
      setGeometry(data.geometry);
      setSummary(data.summary);
      toast.success("Ruta optimizada");
    } catch (e) {
      toast.error("Error al optimizar la ruta");
    } finally {
      setOptimizing(false);
    }
  };

  const changeMetric = (m) => {
    setMetric(m);
  };

  const handleSave = async () => {
    if (stops.length === 0) {
      toast.error("No hay paradas para guardar");
      return;
    }
    const name = routeName.trim() || `Ruta ${new Date().toLocaleDateString("es-ES")}`;
    try {
      await saveRoute({ name, stops, metric, round_trip: roundTrip, depot_index: 0 });
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
      a.download = "ruta_optimizada.xlsx";
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
    setRoundTrip(r.round_trip ?? true);
    clearRoute();
    setSavedOpen(false);
    toast.success(`Ruta "${r.name}" cargada`);
    setTimeout(() => recalc(parsed), 100);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Toaster theme="dark" position="top-right" richColors />
      {/* Header */}
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#FF6B00] rounded-md flex items-center justify-center">
            <Truck size={18} className="text-black" />
          </div>
          <div>
            <h1 className="font-head text-base font-extrabold text-white leading-none tracking-tight">RUTA<span className="text-[#FF6B00]">OPT</span></h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Optimizador de rutas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" data-testid="file-input" />
          <button data-testid="import-btn" onClick={() => fileRef.current?.click()} disabled={importing}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar Excel
          </button>
          <button data-testid="open-saved-btn" onClick={() => setSavedOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-md transition-colors">
            <FolderOpen size={14} /> Rutas
          </button>
          <button data-testid="export-btn" onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-md transition-colors">
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

          {/* Add panel */}
          <div className="p-3 border-b border-slate-800">
            <AddStopPanel onAdd={addStop} />
          </div>

          {/* Metric toggle */}
          <div className="px-3 pt-3 pb-2 flex items-center gap-2">
            <div className="flex bg-slate-800 border border-slate-700 rounded-md p-0.5 flex-1">
              <button data-testid="metric-duration" onClick={() => changeMetric("duration")}
                className={`flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1.5 rounded transition-colors ${metric === "duration" ? "bg-[#FF6B00] text-black" : "text-slate-400 hover:text-white"}`}>
                <Clock size={13} /> Más rápido
              </button>
              <button data-testid="metric-distance" onClick={() => changeMetric("distance")}
                className={`flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1.5 rounded transition-colors ${metric === "distance" ? "bg-[#FF6B00] text-black" : "text-slate-400 hover:text-white"}`}>
                <Ruler size={13} /> Más corto
              </button>
            </div>
            <button data-testid="roundtrip-toggle" onClick={() => setRoundTrip((v) => !v)} title="Volver al depósito"
              className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-md border transition-colors ${roundTrip ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}>
              <RefreshCw size={13} /> Ida y vuelta
            </button>
          </div>

          {/* Stop list */}
          <div className="flex-1 overflow-y-auto thin-scroll px-3 pb-2 min-h-0">
            <StopList stops={stops} onReorder={reorder} onRemove={removeStop} onSetDepot={setDepot} />
          </div>

          {/* Save + Optimize */}
          <div className="p-3 border-t border-slate-700 space-y-2 bg-slate-900">
            <div className="flex gap-2">
              <input data-testid="route-name-input" value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Nombre de la ruta"
                className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#FF6B00] placeholder:text-slate-500" />
              <button data-testid="save-btn" onClick={handleSave}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 rounded-md transition-colors">
                <Save size={14} /> Guardar
              </button>
            </div>
            <motion.button whileTap={{ scale: 0.98 }} data-testid="optimize-btn" onClick={handleOptimize} disabled={optimizing || stops.length < 2}
              className="w-full flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#FF8533] text-black font-extrabold text-sm py-3 rounded-sm shadow-[2px_2px_0px_rgba(255,107,0,0.5)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {optimizing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
              {optimizing ? "Optimizando..." : "Optimizar ruta"}
            </motion.button>
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative min-w-0">
          <MapView stops={stops} geometry={geometry} />
          {stops.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
              <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-6 py-5 text-center max-w-sm">
                <RouteIcon size={32} className="mx-auto mb-3 text-[#FF6B00]" />
                <p className="text-white font-semibold">Empieza a planificar tu ruta</p>
                <p className="text-slate-400 text-sm mt-1">Importa un Excel o añade paradas en el panel de la izquierda.</p>
              </div>
            </div>
          )}
        </main>
      </div>

      <SavedRoutesDialog open={savedOpen} onClose={() => setSavedOpen(false)} onLoad={handleLoad} />
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
