import { useState, useEffect } from "react";
import { X, MapPin, AlertTriangle, HelpCircle, Split } from "lucide-react";
import { toast } from "sonner";

const REASONS = {
  not_found: { label: "No encontrada", icon: HelpCircle, color: "text-red-400" },
  multiple: { label: "Varios resultados", icon: AlertTriangle, color: "text-amber-400" },
  far_apart: { label: "Resultados muy separados", icon: Split, color: "text-amber-400" },
};

export const GeocodeResolveDialog = ({ open, pending, onConfirm, onClose }) => {
  const [sel, setSel] = useState({});

  useEffect(() => {
    if (open) {
      const init = {};
      pending.forEach((p) => {
        init[p.id] = p.candidates && p.candidates.length > 0
          ? { mode: "candidate", candIndex: 0, lat: "", lon: "" }
          : { mode: "manual", candIndex: 0, lat: "", lon: "" };
      });
      setSel(init);
    }
  }, [open, pending]);

  if (!open) return null;

  const setFor = (id, patch) => setSel((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const confirm = () => {
    const resolved = [];
    let invalid = 0;
    pending.forEach((p) => {
      const s = sel[p.id] || {};
      if (s.mode === "skip") return;
      let lat, lon;
      if (s.mode === "candidate" && p.candidates[s.candIndex]) {
        lat = p.candidates[s.candIndex].lat;
        lon = p.candidates[s.candIndex].lon;
      } else if (s.mode === "manual") {
        lat = parseFloat(s.lat); lon = parseFloat(s.lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) { invalid += 1; return; }
      }
      if (lat != null && lon != null) {
        const { reason, candidates, ...clean } = p;
        resolved.push({ ...clean, lat, lon });
      }
    });
    if (invalid > 0) {
      toast.error(`Revisa las coordenadas de ${invalid} parada(s) (o elige "Omitir")`);
      return;
    }
    onConfirm(resolved);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        data-testid="geocode-resolve-dialog">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-head text-lg font-bold text-white flex items-center gap-2">
            <MapPin size={20} className="text-[#F26A21]" /> Resolver direcciones ({pending.length})
          </h3>
          <button onClick={onClose} data-testid="close-resolve-dialog" className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-4 overflow-y-auto thin-scroll flex-1 space-y-3">
          {pending.map((p, pi) => {
            const s = sel[p.id] || {};
            const R = REASONS[p.reason] || REASONS.not_found;
            const Icon = R.icon;
            return (
              <div key={p.id} data-testid={`resolve-item-${pi}`} className="border border-slate-700 rounded-md p-3 bg-slate-900/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{p.name || "Parada"}</div>
                    <div className="text-xs text-slate-400 truncate">{p.address}</div>
                  </div>
                  <span className={`shrink-0 flex items-center gap-1 text-[11px] font-bold ${R.color}`}>
                    <Icon size={13} /> {R.label}
                  </span>
                </div>

                {p.candidates && p.candidates.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {p.candidates.map((c, ci) => (
                      <label key={ci} className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded cursor-pointer transition-colors ${s.mode === "candidate" && s.candIndex === ci ? "bg-[#F26A21]/15 border border-[#F26A21]/40" : "hover:bg-slate-800 border border-transparent"}`}>
                        <input type="radio" name={`cand-${p.id}`} checked={s.mode === "candidate" && s.candIndex === ci}
                          onChange={() => setFor(p.id, { mode: "candidate", candIndex: ci })}
                          className="accent-[#F26A21] mt-0.5" data-testid={`resolve-${pi}-cand-${ci}`} />
                        <span className="text-slate-200">{c.display_name}</span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input type="radio" name={`cand-${p.id}`} checked={s.mode === "manual"}
                      onChange={() => setFor(p.id, { mode: "manual" })} className="accent-[#F26A21]" data-testid={`resolve-${pi}-manual`} />
                    Lat/Lon manual
                  </label>
                  {s.mode === "manual" && (
                    <>
                      <input placeholder="Latitud" value={s.lat} onChange={(e) => setFor(p.id, { lat: e.target.value })}
                        className="w-28 bg-slate-900 border border-slate-700 text-white text-xs font-mono-tech rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#F26A21]" data-testid={`resolve-${pi}-lat`} />
                      <input placeholder="Longitud" value={s.lon} onChange={(e) => setFor(p.id, { lon: e.target.value })}
                        className="w-28 bg-slate-900 border border-slate-700 text-white text-xs font-mono-tech rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#F26A21]" data-testid={`resolve-${pi}-lon`} />
                    </>
                  )}
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-auto">
                    <input type="radio" name={`cand-${p.id}`} checked={s.mode === "skip"}
                      onChange={() => setFor(p.id, { mode: "skip" })} className="accent-slate-500" data-testid={`resolve-${pi}-skip`} />
                    Omitir
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-md transition-colors">Cancelar</button>
          <button data-testid="resolve-confirm-btn" onClick={confirm}
            className="bg-[#F26A21] hover:bg-[#f58220] text-white font-bold text-sm px-5 py-2 rounded-sm transition-colors">
            Añadir paradas
          </button>
        </div>
      </div>
    </div>
  );
};
