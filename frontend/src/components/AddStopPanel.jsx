import { useState, useRef } from "react";
import { Search, MapPin, Plus, Loader2 } from "lucide-react";
import { geocode } from "../lib/api";
import { toast } from "sonner";

const inputCls =
  "w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#FF6B00] focus:border-[#FF6B00] placeholder:text-slate-500 transition-colors";

export const AddStopPanel = ({ onAdd }) => {
  const [tab, setTab] = useState("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [name, setName] = useState("");
  const timer = useRef(null);

  const runSearch = (value) => {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await geocode(value);
        setResults(data);
      } catch (e) {
        toast.error("Error al buscar dirección");
      } finally {
        setSearching(false);
      }
    }, 450);
  };

  const pickResult = (r) => {
    onAdd({
      name: r.display_name.split(",")[0].trim(),
      address: r.display_name,
      lat: r.lat,
      lon: r.lon,
    });
    toast.success("Parada añadida");
    setQ("");
    setResults([]);
  };

  const addManual = () => {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (Number.isNaN(la) || Number.isNaN(lo)) {
      toast.error("Latitud y longitud inválidas");
      return;
    }
    onAdd({ name: name || `Parada (${la.toFixed(4)}, ${lo.toFixed(4)})`, address: "", lat: la, lon: lo });
    toast.success("Parada añadida");
    setLat("");
    setLon("");
    setName("");
  };

  return (
    <div className="border border-slate-700 rounded-md bg-slate-800/60 overflow-hidden">
      <div className="flex">
        <button
          data-testid="tab-search"
          onClick={() => setTab("search")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
            tab === "search" ? "bg-[#FF6B00] text-black" : "text-slate-400 hover:text-white"
          }`}
        >
          <Search size={14} /> Buscar
        </button>
        <button
          data-testid="tab-coords"
          onClick={() => setTab("coords")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
            tab === "coords" ? "bg-[#FF6B00] text-black" : "text-slate-400 hover:text-white"
          }`}
        >
          <MapPin size={14} /> Lat/Lon
        </button>
      </div>

      <div className="p-3">
        {tab === "search" ? (
          <div className="relative">
            <div className="relative">
              <input
                data-testid="search-input"
                className={inputCls + " pr-8"}
                placeholder="Calle y número, ciudad..."
                value={q}
                onChange={(e) => runSearch(e.target.value)}
              />
              {searching && (
                <Loader2 size={16} className="absolute right-2.5 top-2.5 animate-spin text-[#FF6B00]" />
              )}
            </div>
            {results.length > 0 && (
              <div className="mt-2 max-h-56 overflow-y-auto thin-scroll rounded-md border border-slate-700 bg-slate-900">
                {results.map((r, i) => (
                  <button
                    key={i}
                    data-testid={`search-result-${i}`}
                    onClick={() => pickResult(r)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white border-b border-slate-800 last:border-0 flex gap-2 transition-colors"
                  >
                    <MapPin size={14} className="text-[#FF6B00] shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              data-testid="manual-name"
              className={inputCls}
              placeholder="Nombre (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                data-testid="manual-lat"
                className={inputCls + " font-mono-tech"}
                placeholder="Latitud"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
              <input
                data-testid="manual-lon"
                className={inputCls + " font-mono-tech"}
                placeholder="Longitud"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
              />
            </div>
            <button
              data-testid="add-manual-btn"
              onClick={addManual}
              className="w-full flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#FF8533] text-black font-bold text-sm py-2 rounded-sm transition-colors"
            >
              <Plus size={16} /> Añadir parada
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
