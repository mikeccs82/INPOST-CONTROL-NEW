import { useEffect, useState } from "react";
import { X, Users, UserPlus, Trash2, Pencil, Truck, Phone, IdCard, ArrowLeft, Save } from "lucide-react";
import { listDrivers, createDriver, updateDriver, deleteDriver } from "../lib/api";
import { toast } from "sonner";

const EMPTY = { nombres: "", apellidos: "", dni: "", telefono: "", marca: "", modelo: "", anio: "", tamano: "", matricula: "" };

const inputCls =
  "w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21] focus:border-[#F26A21] placeholder:text-slate-500 transition-colors";

const Field = ({ label, value, onChange, testid, placeholder }) => (
  <div>
    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">{label}</label>
    <input data-testid={testid} className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export const DriversDialog = ({ open, onClose }) => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("list"); // 'list' | 'form'
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try { setDrivers(await listDrivers()); }
    catch (e) { toast.error("No se pudieron cargar los conductores"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (open) { setMode("list"); refresh(); }
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const startAdd = () => { setForm(EMPTY); setEditId(null); setMode("form"); };
  const startEdit = (d) => { setForm({ ...EMPTY, ...d }); setEditId(d.id); setMode("form"); };

  const save = async () => {
    if (!form.nombres.trim()) { toast.error("El nombre es obligatorio"); return; }
    try {
      if (editId) { await updateDriver(editId, form); toast.success("Conductor actualizado"); }
      else { await createDriver(form); toast.success("Conductor añadido"); }
      setMode("list");
      refresh();
    } catch (e) { toast.error("Error al guardar el conductor"); }
  };

  const remove = async (id) => {
    try { await deleteDriver(id); setDrivers((d) => d.filter((x) => x.id !== id)); toast.success("Conductor eliminado"); }
    catch (e) { toast.error("Error al eliminar"); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" data-testid="drivers-dialog">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-head text-lg font-bold text-white flex items-center gap-2">
            {mode === "form" && (
              <button onClick={() => setMode("list")} data-testid="drivers-back" className="text-slate-400 hover:text-white mr-1"><ArrowLeft size={18} /></button>
            )}
            <Users size={20} className="text-[#F26A21]" />
            {mode === "form" ? (editId ? "Editar conductor" : "Nuevo conductor") : "Conductores"}
          </h3>
          <button onClick={onClose} data-testid="close-drivers-dialog" className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {mode === "list" ? (
          <>
            <div className="p-4 overflow-y-auto thin-scroll flex-1">
              {loading ? (
                <p className="text-slate-400 text-sm text-center py-8">Cargando...</p>
              ) : drivers.length === 0 ? (
                <div className="text-center text-slate-500 py-10">
                  <Users size={30} className="mx-auto mb-3 opacity-40" />
                  No hay conductores todavía.
                </div>
              ) : (
                drivers.map((d) => (
                  <div key={d.id} data-testid={`driver-${d.id}`} className="border border-slate-700 rounded-md p-3 mb-2 flex items-center justify-between hover:border-slate-500 transition-colors">
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">{d.nombres} {d.apellidos}</div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                        {d.dni && <span className="flex items-center gap-1"><IdCard size={12} /> {d.dni}</span>}
                        {d.telefono && <span className="flex items-center gap-1"><Phone size={12} /> {d.telefono}</span>}
                        {(d.marca || d.modelo) && <span className="flex items-center gap-1"><Truck size={12} /> {d.marca} {d.modelo} {d.anio && `(${d.anio})`}</span>}
                        {d.tamano && <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 font-mono-tech">{d.tamano}</span>}
                        {d.matricula && <span className="font-mono-tech text-[#F26A21]">{d.matricula}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button data-testid={`edit-driver-${d.id}`} onClick={() => startEdit(d)} className="text-slate-400 hover:text-white transition-colors"><Pencil size={16} /></button>
                      <button data-testid={`delete-driver-${d.id}`} onClick={() => remove(d.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-700">
              <button data-testid="add-driver-btn" onClick={startAdd}
                className="w-full flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold text-sm py-2.5 rounded-sm transition-colors">
                <UserPlus size={16} /> Agregar conductor
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 overflow-y-auto thin-scroll flex-1 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">Datos del conductor</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombres" testid="driver-nombres" value={form.nombres} onChange={(v) => set("nombres", v)} />
                  <Field label="Apellidos" testid="driver-apellidos" value={form.apellidos} onChange={(v) => set("apellidos", v)} />
                  <Field label="DNI" testid="driver-dni" value={form.dni} onChange={(v) => set("dni", v)} />
                  <Field label="Teléfono" testid="driver-telefono" value={form.telefono} onChange={(v) => set("telefono", v)} />
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">Datos del furgón</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Marca del furgón" testid="driver-marca" value={form.marca} onChange={(v) => set("marca", v)} />
                  <Field label="Modelo del furgón" testid="driver-modelo" value={form.modelo} onChange={(v) => set("modelo", v)} />
                  <Field label="Año del vehículo" testid="driver-anio" value={form.anio} onChange={(v) => set("anio", v)} />
                  <Field label="Tamaño" testid="driver-tamano" value={form.tamano} onChange={(v) => set("tamano", v)} placeholder="L3H2" />
                  <Field label="Matrícula" testid="driver-matricula" value={form.matricula} onChange={(v) => set("matricula", v)} />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
              <button onClick={() => setMode("list")} className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-md transition-colors">Cancelar</button>
              <button data-testid="save-driver-btn" onClick={save}
                className="flex items-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold text-sm px-5 py-2 rounded-sm transition-colors">
                <Save size={15} /> Guardar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
