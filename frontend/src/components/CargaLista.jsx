import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Hash, ShoppingBag, Package, CheckCircle2, Truck, RotateCcw } from "lucide-react";
import { myRouteConfig, mySacas } from "../lib/api";

export const CargaLista = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    Promise.all([myRouteConfig(), mySacas()])
      .then(([rc, sc]) => {
        const positions = sc.session?.positions || [];
        const posByStop = {};
        positions.forEach((p) => { if (p.stop_id) posByStop[p.stop_id] = p; });
        const routeStops = rc.driver_route?.stops || [];
        // parada = orden de reparto (1..N). Cargamos de atrás hacia adelante (última -> primera).
        const list = routeStops.map((s, i) => {
          const p = posByStop[s.id] || {};
          return {
            parada: i + 1,
            posicion: p.position ?? null,
            codigo: s.order_id || "—",
            sacas: p.sacas ?? 0,
            bultos: p.bultos ?? 0,
          };
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

  const done = idx >= items.length;
  const cur = items[idx];
  const pct = Math.round((idx / items.length) * 100);

  if (done) return (
    <div data-testid="carga-lista-view" className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-slate-950">
      <div className="w-20 h-20 rounded-full bg-emerald-600/20 border-2 border-emerald-500 flex items-center justify-center mb-4">
        <CheckCircle2 size={44} className="text-emerald-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-1">¡Furgón cargado!</h1>
      <p className="text-slate-400 text-sm mb-5">Has ingresado las {items.length} paradas.</p>
      <button data-testid="carga-lista-reset" onClick={() => setIdx(0)}
        className="flex items-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors">
        <RotateCcw size={16} /> Revisar de nuevo
      </button>
    </div>
  );

  return (
    <div data-testid="carga-lista-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4 flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white">Carga al furgón</h1>
          <span data-testid="carga-lista-progress" className="text-sm font-mono-tech text-slate-300">{idx + 1} / {items.length}</span>
        </div>
        <p className="text-xs text-slate-400 mb-3">Carga de la última parada a la primera</p>

        {/* progress bar */}
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-5">
          <div className="h-full bg-[#F26A21] transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>

        {/* current card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-700 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-[#F26A21] flex items-center justify-center">
                <MapPin size={22} className="text-white" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parada</div>
                <div className="text-3xl font-extrabold text-white leading-none">{cur.parada}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Posición</div>
              <div className="text-3xl font-extrabold text-[#F26A21] leading-none">{cur.posicion ?? "—"}</div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 flex items-center gap-2 mb-3">
            <Hash size={15} className="text-slate-500 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ID orden</span>
            <span className="ml-auto text-base font-mono-tech font-bold text-white truncate">{cur.codigo}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#F26A21]/10 border border-[#F26A21]/30 p-3 flex items-center gap-2">
              <ShoppingBag size={20} className="text-[#F26A21]" />
              <div><div className="text-2xl font-extrabold text-white leading-none">{cur.sacas}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">Sacas</div></div>
            </div>
            <div className="rounded-lg bg-[#1E5AA8]/10 border border-[#1E5AA8]/30 p-3 flex items-center gap-2">
              <Package size={20} className="text-[#4b8fe0]" />
              <div><div className="text-2xl font-extrabold text-white leading-none">{cur.bultos}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">Bultos</div></div>
            </div>
          </div>
        </div>

        <button
          data-testid="carga-lista-ingresado"
          onClick={() => setIdx((i) => i + 1)}
          className="mt-auto w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg py-5 rounded-2xl transition-colors active:scale-[0.98] shadow-lg shadow-emerald-900/40"
        >
          <CheckCircle2 size={26} /> Ingresado al furgón
        </button>
        {idx > 0 && (
          <button data-testid="carga-lista-prev" onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="mt-2 w-full text-center text-xs text-slate-400 hover:text-white py-2">◄ Anterior</button>
        )}
      </div>
    </div>
  );
};
