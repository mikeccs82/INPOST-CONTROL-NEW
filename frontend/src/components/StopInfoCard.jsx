import { X, MapPin, Clock, Phone, Mail, StickyNote, Hash, ArrowRight, ArrowLeft } from "lucide-react";

const Row = ({ icon, label, value }) =>
  value ? (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-slate-500 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
        <div className="text-slate-200 break-words">{value}</div>
      </div>
    </div>
  ) : null;

export const StopInfoCard = ({ stop, index, total, onClose }) => {
  if (!stop) return null;
  return (
    <div
      data-testid="stop-info-card"
      className="absolute top-4 left-4 z-[600] w-80 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-[#F26A21]">
        <div className="flex items-center gap-2 text-black font-extrabold">
          <span className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center font-mono-tech text-white">{index + 1}</span>
          <span className="text-white text-sm truncate max-w-[180px]" title={stop.name}>{stop.name || "Parada"}</span>
        </div>
        <button data-testid="close-info-card" onClick={onClose} className="text-white/80 hover:text-white">
          <X size={18} />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <Row icon={<MapPin size={15} />} label="Dirección" value={stop.address} />
        <Row icon={<Hash size={15} />} label="Coordenadas" value={`${Number(stop.lat).toFixed(6)}, ${Number(stop.lon).toFixed(6)}`} />
        {(stop.window_from || stop.window_to) && (
          <Row icon={<Clock size={15} />} label="Ventana horaria" value={`${stop.window_from || "—"} → ${stop.window_to || "—"}`} />
        )}
        <Row icon={<Phone size={15} />} label="Teléfono" value={stop.phone} />
        <Row icon={<Mail size={15} />} label="Email" value={stop.email} />
        <Row icon={<Hash size={15} />} label="ID de orden" value={stop.order_id} />
        <Row icon={<StickyNote size={15} />} label="Notas" value={stop.notes} />

        <div className="pt-2 border-t border-slate-700 flex items-center gap-4 text-[11px] font-semibold">
          <span className="flex items-center gap-1 text-emerald-400"><ArrowLeft size={13} /> Tramo anterior</span>
          <span className="flex items-center gap-1 text-red-400">Tramo siguiente <ArrowRight size={13} /></span>
        </div>
        <p className="text-[10px] text-slate-500">Parada {index + 1} de {total}</p>
      </div>
    </div>
  );
};
