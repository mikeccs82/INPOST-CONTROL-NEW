import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Route, User, MapPin, Clock, Anchor, CalendarClock, X, Loader2, Trash2, Upload, Eye, Save, FlaskConical } from "lucide-react";
import {
  listRouteConfigs, createRouteConfig, updateRouteConfig, deleteRouteConfig,
  updateConfigStops, getRouteConfig, listUsers,
} from "../lib/api";
import { fmtDistance, fmtDuration } from "../lib/format";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
};

const Field = ({ label, children }) => (
  <div>
    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">{label}</label>
    {children}
  </div>
);
const inputCls = "w-full bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21]";

const RouteForm = ({ drivers, values, setValues, takenIds = [], currentDriverIds = [] }) => {
  const selected = values.driver_ids || [];
  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setValues({ ...values, driver_ids: next });
  };
  return (
  <div className="space-y-3">
    <Field label="Número / Nombre de ruta">
      <input data-testid="rc-number" className={inputCls} value={values.number} onChange={(e) => setValues({ ...values, number: e.target.value })} placeholder="Ej. 8002" />
    </Field>
    <Field label="Conductores (uno o varios)">
      <div data-testid="rc-drivers" className="max-h-44 overflow-y-auto thin-scroll rounded-md border border-slate-600 bg-slate-900 divide-y divide-slate-800">
        {drivers.length === 0 && <div className="px-3 py-2 text-sm text-slate-500">No hay conductores</div>}
        {drivers.map((d) => {
          const taken = takenIds.includes(d.id) && !currentDriverIds.includes(d.id);
          const checked = selected.includes(d.id);
          return (
            <label key={d.id} className={`flex items-center gap-2.5 px-3 py-2 text-sm ${taken ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-slate-800"}`}>
              <input type="checkbox" checked={checked} disabled={taken} onChange={() => toggle(d.id)} className="w-4 h-4 accent-[#F26A21]" />
              <span className="text-white">{d.nombres} {d.apellidos} <span className="text-slate-500 font-mono-tech">({d.username})</span></span>
              {taken && <span className="ml-auto text-[10px] uppercase text-amber-400">ya tiene ruta</span>}
            </label>
          );
        })}
      </div>
    </Field>
    <div className="grid grid-cols-3 gap-3">
      <Field label="Hora de carga">
        <input data-testid="rc-load" type="time" className={inputCls} value={values.load_time || ""} onChange={(e) => setValues({ ...values, load_time: e.target.value })} />
      </Field>
      <Field label="Muelle">
        <input data-testid="rc-dock" type="number" min="0" className={inputCls} value={values.dock ?? ""} onChange={(e) => setValues({ ...values, dock: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Nº" />
      </Field>
      <Field label="Hora de salida">
        <input data-testid="rc-departure" type="time" className={inputCls} value={values.departure_time || ""} onChange={(e) => setValues({ ...values, departure_time: e.target.value })} />
      </Field>
    </div>
  </div>
  );
};

const Modal = ({ children, onClose, testid, wide }) => (
  <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
    <div data-testid={testid} onClick={(e) => e.stopPropagation()}
      className={`bg-slate-800 border border-slate-700 rounded-lg w-full ${wide ? "max-w-lg" : "max-w-md"} shadow-2xl max-h-[90vh] overflow-y-auto thin-scroll`}>
      {children}
    </div>
  </div>
);

const StopsViewer = ({ route, onClose }) => (
  <Modal testid="rc-stops-viewer" onClose={onClose} wide>
    <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-800">
      <h3 className="font-bold text-white flex items-center gap-2"><MapPin size={18} className="text-[#F26A21]" /> Paradas · Ruta {route.number}</h3>
      <button data-testid="rc-stops-close" onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
    </div>
    <div className="p-4 space-y-2">
      {(route.stops || []).length === 0
        ? <p className="text-slate-500 text-sm text-center py-8">Esta ruta no tiene paradas. Usa "Actualizar paradas" para subir un Excel.</p>
        : route.stops.map((s, i) => (
          <div key={s.id || i} data-testid={`rc-stop-${i}`} className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex gap-3">
            <div className="shrink-0 w-7 h-7 flex items-center justify-center font-mono-tech font-bold text-xs bg-[#F26A21] text-white rounded-full">{i + 1}</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white break-words">{s.name || "Parada"}</div>
              {s.address && <div className="text-xs text-slate-400 break-words">{s.address}</div>}
              {(s.window_from || s.window_to) && <div className="text-[11px] font-mono-tech text-slate-300 mt-0.5">{(s.window_from || "—").slice(0, 5)} → {(s.window_to || "—").slice(0, 5)}</div>}
              {s.notes && <div className="text-[11px] text-amber-300/90 mt-0.5">{s.notes}</div>}
            </div>
          </div>
        ))}
    </div>
  </Modal>
);

const DetailModal = ({ id, drivers, takenIds, onClose, onChanged }) => {
  const [route, setRoute] = useState(null);
  const [values, setValues] = useState({ number: "", driver_ids: [], load_time: "", dock: null, departure_time: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewStops, setViewStops] = useState(false);

  const refresh = useCallback(async () => {
    const r = await getRouteConfig(id);
    setRoute(r);
    setValues({ number: r.number || "", driver_ids: r.driver_ids || (r.driver_id ? [r.driver_id] : []), load_time: r.load_time || "", dock: r.dock ?? null, departure_time: r.departure_time || "" });
  }, [id]);

  useEffect(() => { refresh().catch(() => toast.error("No se pudo cargar la ruta")); }, [refresh]);

  const save = async () => {
    setSaving(true);
    try { await updateRouteConfig(id, values); toast.success("Ruta actualizada"); onChanged(); await refresh(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Error al guardar"); }
    finally { setSaving(false); }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try { const r = await updateConfigStops(id, file); toast.success(`${r.stops_count} paradas cargadas`); onChanged(); await refresh(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Error al subir el Excel"); }
    finally { setUploading(false); }
  };

  const remove = async () => {
    if (!window.confirm("¿Eliminar esta ruta? El conductor quedará libre.")) return;
    try { await deleteRouteConfig(id); toast.success("Ruta eliminada"); onChanged(); onClose(); }
    catch (e) { toast.error("Error al eliminar"); }
  };

  if (!route) return <Modal testid="rc-detail" onClose={onClose}><div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#F26A21]" /></div></Modal>;

  return (
    <>
      <Modal testid="rc-detail" onClose={onClose} wide>
        <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <h3 className="font-bold text-white flex items-center gap-2"><Route size={18} className="text-[#F26A21]" /> Ruta {route.number || "—"}</h3>
          <button data-testid="rc-detail-close" onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <RouteForm drivers={drivers} values={values} setValues={setValues} takenIds={takenIds} currentDriverIds={route.driver_ids || (route.driver_id ? [route.driver_id] : [])} />

          <div className="flex items-center justify-between rounded-md bg-slate-900 border border-slate-700 px-3 py-2">
            <span className="text-sm text-slate-300 flex items-center gap-2"><MapPin size={15} className="text-[#F26A21]" /> {route.stops_count || 0} paradas</span>
            <span className="text-[11px] text-slate-500">Actualizado {fmtDate(route.updated_at)}</span>
          </div>

          {route.sim_summary && (
            <div className="flex items-center justify-between rounded-md bg-[#F26A21]/10 border border-[#F26A21]/30 px-3 py-2" data-testid="rc-detail-sim">
              <span className="text-sm text-[#F26A21] font-semibold flex items-center gap-2"><FlaskConical size={15} /> Simulación: {fmtDistance(route.sim_summary.distance)} · {fmtDuration(route.sim_summary.duration)}</span>
              <span className="text-[11px] text-slate-400">{fmtDate(route.sim_updated_at)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button data-testid="rc-view-stops" onClick={() => setViewStops(true)}
              className="flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#1E5AA8] hover:bg-[#184a8c] py-2.5 rounded-md transition-colors">
              <Eye size={16} /> Ver paradas
            </button>
            <label data-testid="rc-update-stops" className="flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#F26A21] hover:bg-[#f58220] py-2.5 rounded-md transition-colors cursor-pointer">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Actualizar paradas
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={upload} disabled={uploading} />
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
            <button data-testid="rc-save" onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-md transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar cambios
            </button>
            <button data-testid="rc-delete" onClick={remove}
              className="flex items-center justify-center gap-2 text-sm font-semibold text-red-400 hover:text-white hover:bg-red-600 border border-red-500/40 px-3 py-2.5 rounded-md transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </Modal>
      {viewStops && <StopsViewer route={route} onClose={() => setViewStops(false)} />}
    </>
  );
};

const NewModal = ({ drivers, takenIds, onClose, onCreated }) => {
  const [values, setValues] = useState({ number: "", driver_ids: [], load_time: "", dock: null, departure_time: "" });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!values.number.trim()) { toast.error("Escribe un número/nombre de ruta"); return; }
    setSaving(true);
    try {
      const r = await createRouteConfig(values);
      if (file) { try { await updateConfigStops(r.id, file); } catch { toast.warning("Ruta creada, pero el Excel falló. Súbelo desde el detalle."); } }
      toast.success("Ruta creada");
      onCreated();
      onClose();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error al crear la ruta"); }
    finally { setSaving(false); }
  };

  return (
    <Modal testid="rc-new-modal" onClose={onClose} wide>
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="font-bold text-white flex items-center gap-2"><Plus size={18} className="text-[#F26A21]" /> Agregar nueva ruta</h3>
        <button data-testid="rc-new-close" onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
      </div>
      <div className="p-4 space-y-4">
        <RouteForm drivers={drivers} values={values} setValues={setValues} takenIds={takenIds} />
        <Field label="Excel de paradas (opcional)">
          <label className="flex items-center gap-2 text-sm text-slate-300 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 cursor-pointer hover:border-slate-500">
            <Upload size={15} className="text-[#F26A21]" /> {file ? file.name : "Seleccionar archivo…"}
            <input data-testid="rc-new-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </Field>
        <button data-testid="rc-new-submit" onClick={submit} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-2.5 rounded-md transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Crear ruta
        </button>
      </div>
    </Modal>
  );
};

const Card = ({ r, onClick }) => (
  <button data-testid={`rc-card-${r.id}`} onClick={onClick}
    className="w-full text-left bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-[#F26A21] transition-colors active:scale-[0.995]">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-lg bg-[#F26A21]/15 border border-[#F26A21]/40 flex items-center justify-center shrink-0">
        <Route size={20} className="text-[#F26A21]" />
      </div>
      <div className="min-w-0">
        <div className="text-base font-bold text-white truncate">Ruta {r.number || "—"}</div>
        <div className="text-xs text-slate-400 flex items-center gap-1 truncate">
          <User size={12} /> {(r.drivers && r.drivers.length) ? r.drivers.map((d) => (`${d.nombres} ${d.apellidos}`.trim() || d.username)).join(", ") : "Sin asignar"}
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-slate-300"><MapPin size={13} className="text-slate-500" /> {r.stops_count || 0} paradas</div>
      <div className="flex items-center gap-1.5 text-slate-300"><Clock size={13} className="text-slate-500" /> Carga {r.load_time || "—"}</div>
      <div className="flex items-center gap-1.5 text-slate-300"><Anchor size={13} className="text-slate-500" /> Muelle {r.dock ?? "—"}</div>
      <div className="flex items-center gap-1.5 text-slate-300"><CalendarClock size={13} className="text-slate-500" /> {fmtDate(r.updated_at)}</div>
    </div>
    {r.sim_summary && (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#F26A21] font-semibold" data-testid={`rc-sim-${r.id}`}>
        <FlaskConical size={12} /> Simulación: {fmtDistance(r.sim_summary.distance)} · {fmtDuration(r.sim_summary.duration)}
      </div>
    )}
  </button>
);

export const RouteConfigPanel = () => {
  const [items, setItems] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const takenIds = items.flatMap((r) => r.driver_ids || (r.driver_id ? [r.driver_id] : []));

  const load = useCallback(async () => {
    setLoading(true);
    try { const [rc, drv] = await Promise.all([listRouteConfigs(), listUsers()]); setItems(rc); setDrivers((drv || []).filter((d) => d.role !== "admin")); }
    catch (e) { toast.error("No se pudieron cargar las rutas"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div data-testid="route-config-panel" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">Configuración de rutas</h1>
        <p className="text-sm text-slate-400 mb-4">{items.length} ruta(s) · uno o varios conductores por ruta</p>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#F26A21]" /></div>
        ) : items.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-12">Aún no hay rutas. Crea la primera con el botón de abajo.</p>
        ) : (
          <div className="space-y-3">
            {items.map((r) => <Card key={r.id} r={r} onClick={() => setDetailId(r.id)} />)}
          </div>
        )}

        <button data-testid="rc-add-btn" onClick={() => setNewOpen(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-[#F26A21] hover:bg-[#f58220] text-white font-bold text-base py-4 transition-colors active:scale-[0.99]">
          <Plus size={20} /> Agregar nueva ruta
        </button>
      </div>

      {newOpen && <NewModal drivers={drivers} takenIds={takenIds} onClose={() => setNewOpen(false)} onCreated={load} />}
      {detailId && <DetailModal id={detailId} drivers={drivers} takenIds={takenIds} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
};
