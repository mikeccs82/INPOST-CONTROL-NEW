import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Navigation, PackageCheck, Flag } from "lucide-react";
import { myRouteConfig } from "../lib/api";

const gmapsUrl = (s) => {
  if (s.lat != null && s.lon != null) return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=driving`;
  const q = encodeURIComponent(s.address || s.name || "");
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
};

export const RepartoView = () => {
  const [loading, setLoading] = useState(true);
  const [stops, setStops] = useState([]);
  const [routeNumber, setRouteNumber] = useState(null);

  useEffect(() => {
    myRouteConfig()
      .then((rc) => {
        setRouteNumber(rc.route_number);
        setStops(rc.driver_route?.stops || []);
      })
      .catch(() => toast.error("No se pudo cargar la ruta"))
      .finally(() => setLoading(false));
  }, []);

  const irA = (s) => window.open(gmapsUrl(s), "_blank", "noopener");

  if (loading) return <div className="flex-1 flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-[#F26A21]" /></div>;

  if (stops.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-slate-950">
      <PackageCheck size={40} className="text-slate-600 mb-3" />
      <p className="text-slate-300 font-semibold mb-1">No hay ruta preparada</p>
      <p className="text-slate-500 text-sm">Prepara y carga tu ruta en los pasos anteriores.</p>
    </div>
  );

  const next = stops[0];

  return (
    <div data-testid="reparto-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white">Ruta a Reparto</h1>
          <span className="text-sm font-mono-tech text-slate-300">{stops.length} paradas</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">{routeNumber ? `Ruta ${routeNumber}` : ""} · Pulsa "Ir" para navegar con Google Maps</p>

        {/* Próxima parada destacada */}
        <div className="rounded-2xl bg-slate-900 border border-[#F26A21]/40 p-4 mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#F26A21] mb-2">Próxima parada</div>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#F26A21] flex items-center justify-center shrink-0 text-white font-extrabold text-lg">1</div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-bold truncate">{next.name || "Parada 1"}</div>
              <div className="text-sm text-slate-400 truncate">{next.address || "—"}</div>
            </div>
          </div>
          <button data-testid="reparto-ir-next" onClick={() => irA(next)}
            className="mt-4 w-full flex items-center justify-center gap-2.5 bg-[#F26A21] hover:bg-[#f58220] text-white font-extrabold text-lg py-4 rounded-2xl transition-colors active:scale-[0.98] shadow-lg shadow-orange-900/30">
            <Navigation size={24} /> Ir con Google Maps
          </button>
        </div>

        {/* Lista completa en orden de reparto */}
        <h2 className="text-sm font-bold text-slate-300 mb-2">Todas las paradas</h2>
        <div className="space-y-2">
          {stops.map((s, i) => (
            <div key={s.id} data-testid={`reparto-stop-${i + 1}`} className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-full bg-slate-800 border border-slate-600 text-white font-bold flex items-center justify-center">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-semibold truncate">{s.name || `Parada ${i + 1}`}</div>
                <div className="text-xs text-slate-500 truncate flex items-center gap-1"><MapPin size={11} className="shrink-0" /> {s.address || "—"}</div>
              </div>
              <button data-testid={`reparto-ir-${i + 1}`} onClick={() => irA(s)}
                className="shrink-0 flex items-center gap-1.5 bg-[#1E5AA8] hover:bg-[#184a8c] text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors active:scale-95">
                <Navigation size={16} /> Ir
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <Flag size={13} /> Fin de la ruta
        </div>
      </div>
    </div>
  );
};
