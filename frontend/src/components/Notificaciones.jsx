import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Bell, X, MapPin, CheckCircle2, Plus, AlertTriangle } from "lucide-react";
import { listNotifications, markNotificationsRead, resolveNotification, addSingleStop, setSobranteDecision } from "../lib/api";

const STATUS_LABEL = { unread: "Nueva", read: "Vista", resolved: "Corregida" };
const STATUS_STYLE = {
  unread: "bg-red-500/15 text-red-300 border-red-500/40",
  read: "bg-slate-700/40 text-slate-300 border-slate-600",
  resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
};

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#F26A21]";

const AddStopModal = ({ notif, onClose, onSaved }) => {
  const [f, setF] = useState({ name: "", address: "", order_id: notif.last4 || "", stop_type: "", window_from: "", window_to: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name.trim() || !f.address.trim()) { toast.error("Nombre y dirección obligatorios"); return; }
    setSaving(true);
    try {
      const r = await addSingleStop(notif.route_config_id, {
        name: f.name, address: f.address, order_id: f.order_id || null,
        stop_type: f.stop_type || null, window_from: f.window_from || null, window_to: f.window_to || null,
      });
      await resolveNotification(notif.id);
      toast.success(`Parada añadida a la Ruta ${notif.route_number} (${r.stops_count} paradas)`);
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo registrar la parada");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div data-testid="add-stop-modal" className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-bold text-white flex items-center gap-2"><Plus size={18} className="text-[#F26A21]" /> Registrar nueva parada</h3>
          <button data-testid="add-stop-close" onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-300">
            Ruta <b className="text-white">{notif.route_number}</b> · se añadirá al Excel guardado de esta ruta. ID detectado: <b className="text-white font-mono-tech">···{notif.last4}</b>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Nombre del destinatario</label>
            <input data-testid="add-stop-name" className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Bazar Central" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Dirección (se geolocaliza)</label>
            <input data-testid="add-stop-address" className={inputCls} value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Calle, número, ciudad" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Identificador (order id)</label>
              <input data-testid="add-stop-orderid" className={inputCls} value={f.order_id} onChange={(e) => set("order_id", e.target.value)} placeholder="ES..." />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Tipo de parada</label>
              <select data-testid="add-stop-type" className={inputCls} value={f.stop_type} onChange={(e) => set("stop_type", e.target.value)}>
                <option value="">Sin tipo</option>
                <option value="P">Particular</option>
                <option value="PD">PUDO</option>
                <option value="L">Locker</option>
                <option value="L24">Locker 24h</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Ventana desde</label>
              <input data-testid="add-stop-wfrom" type="time" className={inputCls} value={f.window_from} onChange={(e) => set("window_from", e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Ventana hasta</label>
              <input data-testid="add-stop-wto" type="time" className={inputCls} value={f.window_to} onChange={(e) => set("window_to", e.target.value)} />
            </div>
          </div>
          <button data-testid="add-stop-submit" onClick={submit} disabled={saving} className="w-full bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Añadir parada a la ruta
          </button>
        </div>
      </div>
    </div>
  );
};

export const Notificaciones = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [confirm, setConfirm] = useState(null); // notif pending confirm
  const [addFor, setAddFor] = useState(null); // notif for add-stop modal
  const [deciding, setDeciding] = useState(null);

  const decide = async (n, decision) => {
    if (n.decision === decision) return;
    setDeciding(n.id);
    try {
      await setSobranteDecision(n.id, decision);
      toast.success(decision === "otra_ruta" ? "Pasado a otra ruta (recogidas quitadas al conductor)" : "Se queda en nave");
      load();
    } catch (e) {
      toast.error("No se pudo actualizar la decisión");
    } finally { setDeciding(null); }
  };

  const load = useCallback((markRead = false) => {
    setLoading(true);
    listNotifications()
      .then((r) => { setItems(r.notifications || []); if (markRead) markNotificationsRead().catch(() => {}); })
      .catch(() => toast.error("No se pudieron cargar las notificaciones"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(true); }, [load]);

  if (loading) return <div className="flex-1 flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-[#F26A21]" /></div>;

  return (
    <div data-testid="notificaciones-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-bold text-white mb-1 flex items-center gap-2"><Bell size={20} className="text-red-500" /> Notificaciones</h1>
        <p className="text-sm text-slate-400 mb-4">{items.length} notificación(es) de los conductores</p>

        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-slate-300 text-left text-xs uppercase tracking-wide">
                <th className="px-3 py-2.5 font-bold">Ruta</th>
                <th className="px-3 py-2.5 font-bold">Tipo de notificación</th>
                <th className="px-3 py-2.5 font-bold">Conductor</th>
                <th className="px-3 py-2.5 font-bold">Estado</th>
                <th className="px-3 py-2.5 font-bold text-right">Corregir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No hay notificaciones.</td></tr>
              )}
              {items.map((n) => (
                <tr key={n.id} data-testid={`notif-row-${n.id}`} className="bg-slate-950 hover:bg-slate-900/60">
                  <td className="px-3 py-2.5 font-mono-tech font-bold text-white">{n.route_number || "—"}</td>
                  <td className="px-3 py-2.5 text-slate-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                      <span>{n.type_label}
                        {n.type === "sobrante_carga"
                          ? <span className="text-slate-500"> · {(n.stops || []).length} parada(s)</span>
                          : (n.last4 ? <span className="text-slate-500 font-mono-tech"> · ···{n.last4}</span> : null)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{n.driver_name || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block text-[11px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[n.status] || STATUS_STYLE.read}`}>{STATUS_LABEL[n.status] || n.status}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {n.type === "sobrante_carga" ? (
                      <div data-testid={`notif-decision-${n.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-600 overflow-hidden">
                        <button data-testid={`notif-nave-${n.id}`} onClick={() => decide(n, "nave")} disabled={deciding === n.id}
                          className={`text-[11px] font-bold px-2.5 py-1.5 transition-colors ${n.decision !== "otra_ruta" ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                          En nave
                        </button>
                        <button data-testid={`notif-otraruta-${n.id}`} onClick={() => decide(n, "otra_ruta")} disabled={deciding === n.id}
                          className={`text-[11px] font-bold px-2.5 py-1.5 transition-colors ${n.decision === "otra_ruta" ? "bg-[#1E5AA8] text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                          Otra ruta
                        </button>
                      </div>
                    ) : n.status === "resolved" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold"><CheckCircle2 size={14} /> Corregida</span>
                    ) : (
                      <button data-testid={`notif-fix-${n.id}`} onClick={() => setConfirm(n)}
                        className="inline-flex items-center gap-1.5 bg-[#F26A21] hover:bg-[#f58220] text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors">
                        <MapPin size={13} /> Corregir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setConfirm(null)}>
          <div data-testid="notif-confirm" className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-[#F26A21]/15 border border-[#F26A21]/40 flex items-center justify-center mx-auto mb-3"><MapPin size={22} className="text-[#F26A21]" /></div>
            <p className="text-lg font-bold text-white mb-1">¿Desea registrar una nueva parada?</p>
            <p className="text-sm text-slate-400 mb-4">Se añadirá a la Ruta {confirm.route_number} (ID ···{confirm.last4}).</p>
            <div className="grid grid-cols-2 gap-2">
              <button data-testid="notif-confirm-no" onClick={() => setConfirm(null)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-lg transition-colors">Cancelar</button>
              <button data-testid="notif-confirm-yes" onClick={() => { setAddFor(confirm); setConfirm(null); }} className="bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-2.5 rounded-lg transition-colors">Sí, registrar</button>
            </div>
          </div>
        </div>
      )}

      {addFor && <AddStopModal notif={addFor} onClose={() => setAddFor(null)} onSaved={() => { setAddFor(null); load(); }} />}
    </div>
  );
};
