import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Hash, ShoppingBag, Package, CheckCircle2, Truck, Undo2, ArrowRight, AlertTriangle, X } from "lucide-react";
import { myRouteConfig, mySacas, saveDriverRouteOrder } from "../lib/api";

export const CargaLista = ({ onFinish }) => {
  const [loading, setLoading] = useState(true);
  const [stops, setStops] = useState([]);       // objetos completos en orden de reparto
  const [items, setItems] = useState([]);       // meta por parada, en orden inverso (última->primera)
  const [loaded, setLoaded] = useState(() => new Set());
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([myRouteConfig(), mySacas()])
      .then(([rc, sc]) => {
        const posByStop = {};
        (sc.session?.positions || []).forEach((p) => { if (p.stop_id) posByStop[p.stop_id] = p; });
        const rs = rc.driver_route?.stops || [];
        setStops(rs);
        const list = rs.map((s, i) => {
          const p = posByStop[s.id] || {};
          return { id: s.id, parada: i + 1, posicion: p.position ?? null, codigo: s.order_id || "—", sacas: p.sacas ?? 0, bultos: p.bultos ?? 0 };
        }).reverse();
        setItems(list);
      })
      .catch(() => toast.error("No se pudo cargar la lista"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-[#F26A21]" /></div>;
  if (items.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-slate-950">
      <Truck size={40} className="text-slate-600 mb-3" />
      <p className="text-slate-300 font-semibold mb-1">No hay ruta preparada</p>
      <p className="text-slate-500 text-sm">Genera tu ruta en "Ordenar Sacas → Siguiente paso".</p>
    </div>
  );

  const total = items.length;
  const count = loaded.size;
  const complete = count === total;
  const current = items.find((it) => !loaded.has(it.id));
  const loadedList = items.filter((it) => loaded.has(it.id));

  const ingresar = () => { if (current) setLoaded((s) => new Set(s).add(current.id)); };
  const devolver = (id) => setLoaded((s) => { const n = new Set(s); n.delete(id); return n; });

  const proceed = async () => {
    setSaving(true);
    try {
      const ordered = stops.filter((s) => loaded.has(s.id));   // solo las cargadas, en orden de reparto
      await saveDriverRouteOrder(ordered);
      toast.success(`Ruta actualizada: ${ordered.length} paradas`);
      onFinish?.();
    } catch (e) { toast.error("No se pudo actualizar la ruta"); }
    finally { setSaving(false); setConfirm(false); }
  };

  return (
    <div data-testid="carga-lista-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white">Carga al furgón</h1>
          <span data-testid="carga-lista-progress" className="text-sm font-mono-tech text-slate-300">{count} / {total}</span>
        </div>
        <p className="text-xs text-slate-400 mb-3">Carga de la última parada a la primera</p>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-4">
          <div className="h-full bg-[#F26A21] transition-all duration-300" style={{ width: `${(count / total) * 100}%` }} />
        </div>

        {/* Tarjeta actual */}
        {current ? (
          <div className="rounded-2xl bg-slate-900 border border-slate-700 p-5 mb-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-[#F26A21] flex items-center justify-center"><MapPin size={22} className="text-white" /></div>
                <div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parada</div><div className="text-3xl font-extrabold text-white leading-none">{current.parada}</div></div>
              </div>
              <div className="text-right"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Posición</div><div className="text-3xl font-extrabold text-[#F26A21] leading-none">{current.posicion ?? "—"}</div></div>
            </div>
            <div className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 flex items-center gap-2 mb-3">
              <Hash size={15} className="text-slate-500 shrink-0" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ID orden</span>
              <span className="ml-auto text-2xl font-mono-tech font-extrabold text-white truncate">{current.codigo}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-[#F26A21]/10 border border-[#F26A21]/30 p-3 flex items-center gap-2"><ShoppingBag size={20} className="text-[#F26A21]" /><div><div className="text-2xl font-extrabold text-white leading-none">{current.sacas}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">Sacas</div></div></div>
              <div className="rounded-lg bg-[#1E5AA8]/10 border border-[#1E5AA8]/30 p-3 flex items-center gap-2"><Package size={20} className="text-[#4b8fe0]" /><div><div className="text-2xl font-extrabold text-white leading-none">{current.bultos}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">Bultos</div></div></div>
            </div>
            <button data-testid="carga-lista-ingresado" onClick={ingresar}
              className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg py-5 rounded-2xl transition-colors active:scale-[0.98] shadow-lg shadow-emerald-900/40">
              <CheckCircle2 size={26} /> Ingresado al furgón
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-emerald-600/10 border border-emerald-500/30 p-5 mb-3 text-center">
            <CheckCircle2 size={30} className="text-emerald-400 mx-auto mb-1" />
            <p className="text-white font-semibold">Todas las paradas ingresadas</p>
          </div>
        )}

        {/* Contador + botón dinámico */}
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Paradas subidas</span>
            <span className="text-sm font-mono-tech font-bold text-white">{count} / {total}</span>
          </div>
          {complete ? (
            <button data-testid="carga-lista-siguiente" onClick={proceed} disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <>Siguiente <ArrowRight size={18} /></>}
            </button>
          ) : (
            <button data-testid="carga-lista-nocap" onClick={() => setConfirm(true)}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3.5 rounded-xl transition-colors">
              <AlertTriangle size={18} /> No tengo más capacidad
            </button>
          )}
        </div>

        {/* Lista de ingresadas */}
        <h2 className="text-sm font-bold text-emerald-400 mb-2">Ingresadas al furgón ({count})</h2>
        {loadedList.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-4">Aún no has ingresado ninguna parada.</p>
        ) : (
          <div className="space-y-2">
            {loadedList.map((it) => (
              <div key={it.id} data-testid={`carga-loaded-${it.parada}`} className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">{it.parada}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-300 font-mono-tech truncate">Pos {it.posicion ?? "—"} · {it.codigo}</div>
                  <div className="text-[11px] text-slate-500">{it.sacas} sacas · {it.bultos} bultos</div>
                </div>
                <button data-testid={`carga-devolver-${it.parada}`} onClick={() => devolver(it.id)}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-white hover:bg-amber-600 border border-amber-500/40 px-2 py-1.5 rounded-md transition-colors">
                  <Undo2 size={13} /> Devolver a nave
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setConfirm(false)}>
          <div data-testid="carga-confirm-modal" onClick={(e) => e.stopPropagation()} className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0"><AlertTriangle size={20} className="text-amber-400" /></div>
              <div>
                <h3 className="font-bold text-white">¿Confirmas dejar en nave?</h3>
                <p className="text-sm text-slate-300 mt-1">Las <span className="font-bold text-white">{total - count} paradas restantes</span> se quedan en nave. La ruta se actualizará solo con las <span className="font-bold text-emerald-400">{count} ingresadas</span>.</p>
              </div>
              <button onClick={() => setConfirm(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} className="flex-1 text-sm font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg transition-colors">Cancelar</button>
              <button data-testid="carga-confirm-ok" onClick={proceed} disabled={saving || count === 0}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : "Sí, confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
