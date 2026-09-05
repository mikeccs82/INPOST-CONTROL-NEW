import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Loader2, CalendarDays, ArrowUp, ArrowDown, RefreshCw, Activity } from "lucide-react";
import { routeStatus } from "../lib/api";

const fmtDate = (d) => {
  try {
    const [y, m, day] = d.split("-").map(Number);
    const s = new Date(y, m - 1, day).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch { return d; }
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};

const ESTADO_STYLE = {
  "Sin asignar": "bg-slate-700/40 text-slate-300 border-slate-600",
  "Sin empezar": "bg-slate-700/40 text-slate-300 border-slate-600",
  "Ordenando sacas": "bg-amber-500/15 text-amber-300 border-amber-500/40",
  "Ruta ordenada": "bg-sky-500/15 text-sky-300 border-sky-500/40",
  "Cargando vehículo": "bg-indigo-500/15 text-indigo-300 border-indigo-500/40",
  "En reparto": "bg-[#F26A21]/15 text-[#F58220] border-[#F26A21]/40",
  "Finalizado": "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
};

const COLS = [
  { key: "route_number", label: "Ruta" },
  { key: "conductor", label: "Conductor" },
  { key: "estado", label: "Estado actual" },
  { key: "sacas_ordenadas", label: "Sacas ordenadas" },
  { key: "paradas_confirmadas", label: "Paradas confirmadas" },
  { key: "paradas_realizadas", label: "Paradas realizadas" },
  { key: "pct_entregadas", label: "% entregadas" },
  { key: "ultima_entrega", label: "Última entrega" },
  { key: "ultima_interaccion", label: "Última interacción" },
];
const NUM_COLS = ["route_number", "sacas_ordenadas", "paradas_confirmadas", "paradas_realizadas", "pct_entregadas"];

export const EstadoRutas = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [date, setDate] = useState(null);
  const [today, setToday] = useState(null);
  const [sortBy, setSortBy] = useState("route_number");
  const [sortDir, setSortDir] = useState("asc");
  const dateRef = useRef(null);

  const load = useCallback((d, silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    routeStatus(d)
      .then((r) => { setRows(r.rows || []); setDate(r.date); setToday(r.today); dateRef.current = r.date; })
      .catch(() => toast.error("No se pudo cargar el estado de rutas"))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresco en vivo cada 20s (solo si estás viendo HOY)
  useEffect(() => {
    const t = setInterval(() => { if (dateRef.current && dateRef.current === today) load(dateRef.current, true); }, 20000);
    return () => clearInterval(t);
  }, [load, today]);

  const toggleSort = (k) => { if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortBy(k); setSortDir("asc"); } };

  const displayed = [...rows].sort((a, b) => {
    const av = a[sortBy] ?? "", bv = b[sortBy] ?? "";
    let r;
    if (NUM_COLS.includes(sortBy)) r = (parseFloat(av) || 0) - (parseFloat(bv) || 0);
    else r = String(av).localeCompare(String(bv), "es", { numeric: true });
    return sortDir === "asc" ? r : -r;
  });

  if (loading) return <div className="flex-1 flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-[#F26A21]" /></div>;

  return (
    <div data-testid="estado-view" className="flex-1 min-h-0 flex flex-col bg-slate-950">
      <div className="shrink-0 flex items-center justify-between gap-2 bg-slate-900 border-b border-slate-700 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays size={17} className="text-[#F26A21] shrink-0" />
          <span data-testid="estado-date" className="text-sm font-bold text-white truncate">{date ? fmtDate(date) : ""}</span>
          {date && today && date === today && <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-400 shrink-0"><Activity size={11} /> En vivo</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button data-testid="estado-refresh" onClick={() => load(date, true)} disabled={refreshing}
            className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 text-white text-xs font-semibold rounded-md px-2.5 py-1.5 hover:border-[#F26A21] transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Actualizar
          </button>
          <input
            data-testid="estado-date-input"
            type="date"
            value={date || ""}
            max={today || undefined}
            onChange={(e) => e.target.value && load(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-white text-xs font-semibold rounded-md px-2 py-1.5 outline-none focus:border-[#F26A21]"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto thin-scroll p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-3">
            <h1 className="text-xl font-bold text-white">Estado rutas</h1>
            <p className="text-sm text-slate-400">{rows.length} ruta(s) asignada(s) · seguimiento del proceso de cada conductor</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-slate-300 text-left text-xs uppercase tracking-wide">
                  {COLS.map((c) => (
                    <th key={c.key} className="px-3 py-2.5 font-bold whitespace-nowrap">
                      <button data-testid={`estado-sort-${c.key}`} onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-white">
                        {c.label}
                        {sortBy === c.key && (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {displayed.length === 0 && (
                  <tr><td colSpan={COLS.length} className="px-3 py-6 text-center text-slate-500">No hay rutas asignadas para este día.</td></tr>
                )}
                {displayed.map((r) => (
                  <tr key={r.id} data-testid={`estado-row-${r.id}`} className="bg-slate-950 hover:bg-slate-900/60">
                    <td className="px-3 py-2.5 font-mono-tech font-bold text-white">{r.route_number || "—"}</td>
                    <td className="px-3 py-2.5 text-white whitespace-nowrap">{r.conductor || <span className="text-slate-500">Sin asignar</span>}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block text-[11px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${ESTADO_STYLE[r.estado] || ESTADO_STYLE["Sin empezar"]}`}>{r.estado}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-200 font-mono-tech text-center">{r.sacas_ordenadas}</td>
                    <td className="px-3 py-2.5 text-slate-200 font-mono-tech text-center">{r.paradas_confirmadas}</td>
                    <td className="px-3 py-2.5 text-slate-200 font-mono-tech text-center">
                      {r.paradas_realizadas}{r.total_paradas ? <span className="text-slate-500"> / {r.total_paradas}</span> : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${r.pct_entregadas}%` }} />
                        </div>
                        <span className="font-mono-tech text-xs text-emerald-300 w-9 text-right">{r.pct_entregadas}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-300 font-mono-tech whitespace-nowrap">{fmtTime(r.ultima_entrega)}</td>
                    <td className="px-3 py-2.5 text-slate-300 font-mono-tech whitespace-nowrap">{fmtTime(r.ultima_interaccion)}</td>
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
