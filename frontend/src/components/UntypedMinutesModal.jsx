import { useState } from "react";
import { X, Timer } from "lucide-react";

export const UntypedMinutesModal = ({ open, count, initial = 0, onConfirm, onCancel }) => {
  const [val, setVal] = useState(initial);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-sm shadow-2xl" data-testid="untyped-modal">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-head text-base font-bold text-white flex items-center gap-2">
            <Timer size={18} className="text-[#F26A21]" /> Paradas sin tipo
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-300">
            Hay <b className="text-white">{count}</b> parada(s) sin tipo en el Excel. ¿Cuántos minutos asigno a cada una?
          </p>
          <input
            data-testid="untyped-minutes-input"
            type="number" min="0" step="1" autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white font-mono-tech rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21]"
          />
          <p className="text-[11px] text-slate-500">Podrás cambiar el tipo de cada parada después en la lista.</p>
          <button
            data-testid="untyped-confirm-btn"
            onClick={() => onConfirm(Number(val) || 0)}
            className="w-full bg-[#F26A21] hover:bg-[#f58220] text-white font-bold text-sm py-2.5 rounded-sm transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
