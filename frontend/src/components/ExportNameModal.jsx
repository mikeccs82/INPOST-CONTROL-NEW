import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";

export const ExportNameModal = ({ open, defaultName, onConfirm, onCancel }) => {
  const [name, setName] = useState(defaultName || "");
  useEffect(() => { if (open) setName(defaultName || ""); }, [open, defaultName]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-sm shadow-2xl" data-testid="export-modal">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-head text-base font-bold text-white flex items-center gap-2"><Download size={18} className="text-[#F26A21]" /> Nombre del archivo</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <input data-testid="export-name-input" autoFocus value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21]" />
          <p className="text-[11px] text-slate-500">Se descargará como <b>{(name || "ruta").replace(/[\\/:*?"<>|]/g, "-")}.xlsx</b></p>
          <button data-testid="export-confirm-btn" onClick={() => onConfirm((name || "ruta").replace(/[\\/:*?"<>|]/g, "-"))}
            className="w-full bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-2.5 rounded-sm transition-colors">Descargar</button>
        </div>
      </div>
    </div>
  );
};
