import { useState } from "react";
import { AlertTriangle, PackagePlus, ArrowRight, X, Check, Info, Loader2 } from "lucide-react";

// Modal que aparece al pulsar "Siguiente" en Ordenar Ruta.
// Paso A: avisos (sacas en nave = solo recogida, aceptar recogidas en PDA, comparar cantidades).
// Paso B: lista de paradas que NO salieron en Ordenar Sacas, con toggle Recoger/Añadido.
export const PreCargaModal = ({ unscanned = [], saving = false, onCancel, onConfirm }) => {
  const [step, setStep] = useState("aviso");
  const [added, setAdded] = useState(() => new Set());

  const toggle = (id) => setAdded((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onCancel}>
      <div data-testid="precarga-modal" className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <h3 className="font-bold text-white flex items-center gap-2">
            {step === "aviso" ? <><AlertTriangle size={18} className="text-amber-400" /> Antes de cargar</> : <><PackagePlus size={18} className="text-green-400" /> Paradas no escaneadas</>}
          </h3>
          <button data-testid="precarga-close" onClick={onCancel} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        {step === "aviso" ? (
          <div className="p-5 space-y-3 overflow-y-auto thin-scroll">
            <div className="flex items-start gap-3 rounded-xl bg-green-600/10 border border-green-500/30 p-3">
              <PackagePlus size={20} className="text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200">Las sacas que dejaste en la nave generan sus puntos como <b className="text-green-400">solo recogida</b>.</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-[#1E5AA8]/10 border border-[#1E5AA8]/30 p-3">
              <Info size={20} className="text-[#4b8fe0] shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200">Debes <b className="text-white">aceptar todas las recogidas en la PDA</b> y después filtrarlas como <b className="text-green-400">solo recogidas</b>.</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3">
              <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200"><b className="text-white">Compara las cantidades</b> y verifica las diferencias entre lo que te salió y lo que hay en la PDA.</p>
            </div>
            <button data-testid="precarga-aviso-next" onClick={() => setStep("lista")}
              className="w-full flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-3 rounded-xl transition-colors">
              Siguiente <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-2 shrink-0">
              <p className="text-sm text-slate-300">Estas paradas están en tu ruta pero <b className="text-white">no salieron en Ordenar Sacas</b>. Marca <b className="text-green-400">Recoger</b> las que vayas a recoger (se añaden al reparto como solo recogida).</p>
            </div>
            <div className="flex-1 overflow-y-auto thin-scroll px-5 pb-2 min-h-0">
              {unscanned.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No hay paradas pendientes. Todas salieron en Ordenar Sacas.</p>
              ) : (
                <div className="space-y-2">
                  {unscanned.map((s) => {
                    const on = added.has(s.id);
                    return (
                      <div key={s.id} data-testid={`precarga-stop-${s.id}`} className={`rounded-lg border p-3 flex items-center gap-3 ${on ? "bg-green-600/10 border-green-500/40" : "bg-slate-900 border-slate-700"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{s.name || s.order_id || "—"}</div>
                          <div className="text-[11px] text-slate-400 truncate">{s.address}</div>
                          {s.order_id && <div className="text-[10px] font-mono-tech text-slate-500">{s.order_id}</div>}
                        </div>
                        <button data-testid={`precarga-toggle-${s.id}`} onClick={() => toggle(s.id)}
                          className={`shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-md transition-colors ${on ? "bg-green-600 hover:bg-green-500 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"}`}>
                          {on ? <><Check size={14} /> Añadido</> : <><PackagePlus size={14} /> Recoger</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-700 shrink-0">
              <button data-testid="precarga-confirm" onClick={() => onConfirm(unscanned.filter((s) => added.has(s.id)))} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <>Continuar a Carga{added.size > 0 ? ` (+${added.size} recogida${added.size > 1 ? "s" : ""})` : ""} <ArrowRight size={18} /></>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
