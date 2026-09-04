import { useEffect, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { listUsers, createAssignment } from "../lib/api";
import { toast } from "sonner";

const todayStr = () => new Date().toISOString().slice(0, 10);

export const AssignModal = ({ open, onClose, stops, meta, routeName }) => {
  const [drivers, setDrivers] = useState([]);
  const [driverId, setDriverId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [name, setName] = useState(routeName || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayStr());
      setName(routeName || "");
      listUsers().then((d) => { setDrivers(d); if (d[0]) setDriverId(d[0].id); }).catch(() => {});
    }
  }, [open, routeName]);

  if (!open) return null;

  const submit = async () => {
    if (!driverId) { toast.error("Elige un conductor"); return; }
    if (!stops.length) { toast.error("No hay paradas"); return; }
    setSaving(true);
    try {
      await createAssignment({ driver_id: driverId, date, name, stops, ...meta });
      toast.success("Ruta asignada al conductor");
      onClose();
    } catch (e) { toast.error("Error al asignar"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-sm shadow-2xl" data-testid="assign-modal">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-head text-base font-bold text-white flex items-center gap-2"><Send size={18} className="text-[#F26A21]" /> Asignar ruta</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Conductor</label>
            <select data-testid="assign-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21]">
              {drivers.length === 0 && <option value="">— No hay conductores —</option>}
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.nombres} {d.apellidos} ({d.username})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Fecha</label>
              <input data-testid="assign-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21]" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Nombre</label>
              <input data-testid="assign-name" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21]" />
            </div>
          </div>
          <button data-testid="assign-submit" onClick={submit} disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-2.5 rounded-sm transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Asignar {stops.length} parada(s)
          </button>
        </div>
      </div>
    </div>
  );
};
