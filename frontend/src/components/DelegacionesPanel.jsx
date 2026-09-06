import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Building2, MapPin, Plus, Save, Trash2, X } from "lucide-react";
import { listDelegaciones, createDelegacion, updateDelegacion, deleteDelegacion } from "../lib/api";

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#F26A21]";

const Row = ({ d, onSaved }) => {
  const [address, setAddress] = useState(d.nave_address || "");
  const [saving, setSaving] = useState(false);
  const dirty = address.trim() !== (d.nave_address || "");

  const save = async () => {
    if (!address.trim()) { toast.error("La dirección no puede estar vacía"); return; }
    setSaving(true);
    try { await updateDelegacion(d.id, { name: d.name, nave_address: address }); toast.success(`Nave de ${d.name} actualizada`); onSaved(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo guardar"); }
    finally { setSaving(false); }
  };
  const del = async () => {
    if (!window.confirm(`¿Eliminar la delegación ${d.name}?`)) return;
    try { await deleteDelegacion(d.id); toast.success("Delegación eliminada"); onSaved(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo eliminar"); }
  };

  return (
    <div data-testid={`deleg-row-${d.name}`} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-bold text-white"><Building2 size={16} className="text-[#F26A21]" /> {d.name}</div>
        <button data-testid={`deleg-del-${d.name}`} onClick={del} className="text-slate-500 hover:text-red-400"><Trash2 size={15} /></button>
      </div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><MapPin size={11} /> Dirección de la nave (salida y retorno)</label>
      <div className="flex gap-2">
        <input data-testid={`deleg-addr-${d.name}`} className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
        <button data-testid={`deleg-save-${d.name}`} onClick={save} disabled={!dirty || saving}
          className="shrink-0 flex items-center gap-1.5 bg-[#F26A21] hover:bg-[#f58220] disabled:opacity-40 text-white text-sm font-bold px-3 rounded-md transition-colors">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        </button>
      </div>
      <div className="text-[11px] text-slate-500 mt-1 font-mono-tech">{d.nave_lat?.toFixed?.(5)}, {d.nave_lon?.toFixed?.(5)}</div>
    </div>
  );
};

export const DelegacionesPanel = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ name: "", nave_address: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listDelegaciones().then(setItems).catch(() => toast.error("No se pudieron cargar")).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!nf.name.trim() || !nf.nave_address.trim()) { toast.error("Nombre y dirección obligatorios"); return; }
    setSaving(true);
    try { await createDelegacion(nf); toast.success("Delegación creada"); setNf({ name: "", nave_address: "" }); setAdding(false); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "No se pudo crear"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-[#F26A21]" /></div>;

  return (
    <div data-testid="delegaciones-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-white mb-1 flex items-center gap-2"><Building2 size={20} className="text-[#F26A21]" /> Delegaciones y naves</h1>
        <p className="text-sm text-slate-400 mb-4">La dirección de la nave define la salida y el retorno de las rutas de esa delegación.</p>

        <div className="space-y-3">
          {items.map((d) => <Row key={d.id} d={d} onSaved={load} />)}
        </div>

        {adding ? (
          <div className="mt-4 rounded-xl border border-[#F26A21]/40 bg-slate-900 p-4 space-y-2">
            <input data-testid="deleg-new-name" className={inputCls} placeholder="Nombre (ej. Valencia)" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
            <input data-testid="deleg-new-addr" className={inputCls} placeholder="Dirección de la nave" value={nf.nave_address} onChange={(e) => setNf({ ...nf, nave_address: e.target.value })} />
            <div className="flex gap-2">
              <button data-testid="deleg-new-save" onClick={create} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-2.5 rounded-md disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Crear
              </button>
              <button onClick={() => setAdding(false)} className="px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-md"><X size={16} /></button>
            </div>
          </div>
        ) : (
          <button data-testid="deleg-add-btn" onClick={() => setAdding(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-600 hover:border-[#F26A21] text-white font-bold py-3 transition-colors">
            <Plus size={18} /> Añadir delegación
          </button>
        )}
      </div>
    </div>
  );
};
