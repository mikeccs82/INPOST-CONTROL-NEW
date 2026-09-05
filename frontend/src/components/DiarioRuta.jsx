import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, CalendarDays, Copy, Trash2, Plus, Phone, Clock, Anchor, Route as RouteIcon, ArrowUp, ArrowDown } from "lucide-react";
import { routeJournal, listUsers, listRouteConfigs, addJournalEntry, updateJournalEntry, duplicateJournalEntry, deleteJournalEntry, loadAllJournal } from "../lib/api";

const fmtDate = (d) => {
  try {
    const [y, m, day] = d.split("-").map(Number);
    const s = new Date(y, m - 1, day).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch { return d; }
};

export const DiarioRuta = () => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [date, setDate] = useState(null);
  const [today, setToday] = useState(null);
  const [dates, setDates] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newRoute, setNewRoute] = useState("");

  const editable = date === today;

  const load = useCallback((d) => {
    setLoading(true);
    Promise.all([routeJournal(d), listUsers(), listRouteConfigs()])
      .then(([j, us, cfg]) => {
        setEntries(j.entries || []);
        setDrivers((us || []).filter((u) => u.role !== "admin"));
        setConfigs(cfg || []);
        setDate(j.date); setToday(j.today); setDates(j.dates || []);
      })
      .catch(() => toast.error("No se pudo cargar la asignación"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const assign = async (eid, driver_id) => {
    setEntries((es) => es.map((e) => (e.id === eid ? { ...e, driver_id, driver: drivers.find((d) => d.id === driver_id) || null } : e)));
    try { await updateJournalEntry(eid, { driver_id: driver_id || null }); } catch { toast.error("No se pudo asignar"); load(date); }
  };
  const dup = async (eid) => { try { await duplicateJournalEntry(eid); toast.success("Ruta duplicada"); load(date); } catch { toast.error("No se pudo duplicar"); } };
  const del = async (eid) => { try { await deleteJournalEntry(eid); load(date); } catch { toast.error("No se pudo eliminar"); } };
  const addRow = async () => {
    if (!newRoute) return;
    const cfg = configs.find((c) => c.id === newRoute);
    try { await addJournalEntry({ date, route_config_id: cfg?.id, route_number: cfg?.number || "" }); setNewRoute(""); setAdding(false); load(date); }
    catch { toast.error("No se pudo agregar"); }
  };
  const loadAll = async () => {
    try { const r = await loadAllJournal(date); toast.success(r.added ? `${r.added} ruta(s) cargada(s)` : "Ya estaban todas cargadas"); load(date); }
    catch { toast.error("No se pudieron cargar las rutas"); }
  };

  const phoneOf = (e) => e.driver?.telefono || "—";

  const [sortBy, setSortBy] = useState("route_number");
  const [sortDir, setSortDir] = useState("asc");
  const [filters, setFilters] = useState({});
  const COLS = [
    { key: "route_number", label: "Ruta" },
    { key: "conductor", label: "Conductor" },
    { key: "telefono", label: "Teléfono" },
    { key: "load_time", label: "Hora carga" },
    { key: "dock", label: "Muelle" },
  ];
  const valueOf = (e, k) => {
    if (k === "conductor") return e.driver ? (`${e.driver.nombres} ${e.driver.apellidos}`.trim() || e.driver.username) : "";
    if (k === "telefono") return e.driver?.telefono || "";
    if (k === "dock") return e.dock ?? "";
    return e[k] ?? "";
  };
  const toggleSort = (k) => { if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortBy(k); setSortDir("asc"); } };
  const displayed = entries
    .filter((e) => COLS.every((c) => { const f = (filters[c.key] || "").toLowerCase().trim(); return !f || String(valueOf(e, c.key)).toLowerCase().includes(f); }))
    .sort((a, b) => {
      const av = valueOf(a, sortBy), bv = valueOf(b, sortBy);
      const num = ["route_number", "dock"].includes(sortBy);
      let r;
      if (num) r = (parseFloat(av) || 0) - (parseFloat(bv) || 0);
      else r = String(av).localeCompare(String(bv), "es", { numeric: true });
      return sortDir === "asc" ? r : -r;
    });

  if (loading) return <div className="flex-1 flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-[#F26A21]" /></div>;

  return (
    <div data-testid="diario-view" className="flex-1 min-h-0 flex flex-col bg-slate-950">
      {/* Barra de fecha (siempre visible para ver días anteriores) */}
      <div className="shrink-0 flex items-center justify-between gap-2 bg-slate-900 border-b border-slate-700 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays size={17} className="text-[#F26A21] shrink-0" />
          <span data-testid="diario-date" className="text-sm font-bold text-white truncate">{date ? fmtDate(date) : ""}</span>
          {!editable && <span className="text-[10px] font-bold uppercase text-amber-400 shrink-0">Solo lectura</span>}
        </div>
        <input
          data-testid="diario-date-input"
          type="date"
          value={date || ""}
          max={today || undefined}
          onChange={(e) => e.target.value && load(e.target.value)}
          className="shrink-0 bg-slate-800 border border-slate-600 text-white text-xs font-semibold rounded-md px-2 py-1.5 outline-none focus:border-[#F26A21]"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto thin-scroll p-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white">Asignación de Ruta</h1>
              <p className="text-sm text-slate-400">{entries.length} línea(s) · hora/muelle se editan en Configuración de rutas</p>
            </div>
            {editable && (
              <div className="flex items-center gap-2">
                <button data-testid="diario-loadall-btn" onClick={loadAll}
                  className="flex items-center gap-1.5 bg-[#1E5AA8] hover:bg-[#184a8c] text-white text-sm font-bold px-3.5 py-2 rounded-lg transition-colors">
                  <RouteIcon size={16} /> Cargar todas las rutas
                </button>
                <button data-testid="diario-add-btn" onClick={() => setAdding((v) => !v)}
                  className="flex items-center gap-1.5 bg-[#F26A21] hover:bg-[#f58220] text-white text-sm font-bold px-3.5 py-2 rounded-lg transition-colors">
                  <Plus size={16} /> Añadir ruta
                </button>
              </div>
            )}
          </div>

          {adding && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-700 p-3">
              <select data-testid="diario-new-route" value={newRoute} onChange={(e) => setNewRoute(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-600 text-white text-sm rounded-md px-2 py-2 outline-none focus:border-[#F26A21]">
                <option value="">— Elige una ruta —</option>
                {configs.map((c) => <option key={c.id} value={c.id}>Ruta {c.number}</option>)}
              </select>
              <button data-testid="diario-new-save" onClick={addRow} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-md">Agregar</button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-slate-300 text-left text-xs uppercase tracking-wide">
                  {COLS.map((c) => (
                    <th key={c.key} className="px-3 py-2 font-bold align-top">
                      <button data-testid={`diario-sort-${c.key}`} onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-white">
                        {c.label}
                        {sortBy === c.key && (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </button>
                      <input
                        data-testid={`diario-filter-${c.key}`}
                        value={filters[c.key] || ""}
                        onChange={(ev) => setFilters((f) => ({ ...f, [c.key]: ev.target.value }))}
                        placeholder="Filtrar…"
                        className="mt-1.5 w-full bg-slate-800 border border-slate-700 text-white text-[11px] normal-case font-normal rounded px-1.5 py-1 outline-none focus:border-[#F26A21]"
                      />
                    </th>
                  ))}
                  {editable && <th className="px-3 py-2 font-bold text-right align-top">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {displayed.length === 0 && (
                  <tr><td colSpan={editable ? 6 : 5} className="px-3 py-6 text-center text-slate-500">No hay rutas que coincidan.</td></tr>
                )}
                {displayed.map((e) => (
                  <tr key={e.id} data-testid={`diario-row-${e.id}`} className="bg-slate-950 hover:bg-slate-900/60">
                    <td className="px-3 py-2.5 font-mono-tech font-bold text-white">{e.route_number || "—"}</td>
                    <td className="px-3 py-2.5">
                      {editable ? (
                        <select data-testid={`diario-driver-${e.id}`} value={e.driver_id || ""} onChange={(ev) => assign(e.id, ev.target.value)}
                          className="bg-slate-800 border border-slate-600 text-white text-sm rounded-md px-2 py-1.5 outline-none focus:border-[#F26A21] max-w-[220px]">
                          <option value="">— Sin asignar —</option>
                          {drivers.map((d) => <option key={d.id} value={d.id}>{d.nombres} {d.apellidos} ({d.username})</option>)}
                        </select>
                      ) : (
                        <span className="text-white">{e.driver ? `${e.driver.nombres} ${e.driver.apellidos}`.trim() || e.driver.username : "Sin asignar"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300 font-mono-tech">{phoneOf(e)}</td>
                    <td className="px-3 py-2.5 text-slate-300">{e.load_time || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-300">{e.dock ?? "—"}</td>
                    {editable && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button data-testid={`diario-dup-${e.id}`} onClick={() => dup(e.id)} title="Duplicar ruta para otro conductor"
                            className="flex items-center gap-1 text-xs font-semibold text-[#4b8fe0] hover:text-white hover:bg-[#1E5AA8] border border-[#1E5AA8]/50 px-2 py-1.5 rounded-md transition-colors"><Copy size={13} /> Repetir</button>
                          <button data-testid={`diario-del-${e.id}`} onClick={() => del(e.id)} title="Eliminar línea"
                            className="text-slate-400 hover:text-white hover:bg-red-600 border border-slate-700 p-1.5 rounded-md transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
