import { useState, useRef } from "react";
import { Warehouse, Search, MapPin, Save, ChevronDown, Clock, Flag, X, Loader2 } from "lucide-react";
import { geocode } from "../lib/api";
import { toast } from "sonner";

const inputCls =
  "w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21] focus:border-[#F26A21] placeholder:text-slate-500 transition-colors";

const AddressField = ({ label, value, onSelect, testid, accent }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const timer = useRef(null);

  const runSearch = (v) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) return setResults([]);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await geocode(v));
      } catch (e) {
        toast.error("Error al buscar dirección");
      } finally {
        setSearching(false);
      }
    }, 450);
  };

  const pick = (r) => {
    onSelect({ name: label, address: r.display_name, lat: r.lat, lon: r.lon });
    setQ("");
    setResults([]);
  };

  const addManual = () => {
    const la = parseFloat(lat), lo = parseFloat(lon);
    if (Number.isNaN(la) || Number.isNaN(lo)) return toast.error("Coordenadas inválidas");
    onSelect({ name: label, address: `${la.toFixed(5)}, ${lo.toFixed(5)}`, lat: la, lon: lo });
    setLat(""); setLon(""); setManual(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Flag size={11} className={accent} /> {label}
        </span>
        <button data-testid={`${testid}-toggle-manual`} onClick={() => setManual((m) => !m)} className="text-[10px] text-slate-500 hover:text-[#F26A21] transition-colors">
          {manual ? "Buscar dirección" : "Introducir lat/lon"}
        </button>
      </div>

      {value ? (
        <div data-testid={`${testid}-value`} className="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded-md px-3 py-2">
          <MapPin size={14} className={`${accent} shrink-0 mt-0.5`} />
          <span className="text-xs text-slate-200 flex-1 line-clamp-2">{value.address}</span>
          <button data-testid={`${testid}-clear`} onClick={() => onSelect(null)} className="text-slate-500 hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      ) : manual ? (
        <div className="flex gap-2">
          <input data-testid={`${testid}-lat`} className={inputCls + " font-mono-tech"} placeholder="Latitud" value={lat} onChange={(e) => setLat(e.target.value)} />
          <input data-testid={`${testid}-lon`} className={inputCls + " font-mono-tech"} placeholder="Longitud" value={lon} onChange={(e) => setLon(e.target.value)} />
          <button data-testid={`${testid}-add`} onClick={addManual} className="shrink-0 bg-[#F26A21] hover:bg-[#f58220] text-black font-bold text-xs px-3 rounded-md transition-colors">OK</button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input data-testid={`${testid}-search`} className={inputCls + " pl-8"} placeholder="Calle y número, ciudad..." value={q}
              onChange={(e) => runSearch(e.target.value)}
              onBlur={() => setTimeout(() => setResults([]), 180)} />
            {searching && <Loader2 size={14} className="absolute right-2.5 top-2.5 animate-spin text-[#F26A21]" />}
          </div>
          {results.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto thin-scroll rounded-md border border-slate-700 bg-slate-900 shadow-xl">
              {results.map((r, i) => (
                <button key={i} data-testid={`${testid}-result-${i}`} onClick={() => pick(r)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white border-b border-slate-800 last:border-0 flex gap-2 transition-colors">
                  <MapPin size={13} className="text-[#F26A21] shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const WarehousePanel = ({ warehouse, onChange, onSave }) => {
  const [open, setOpen] = useState(true);
  const { start, end, sameAsStart, serviceTimeMin } = warehouse;

  const update = (patch) => onChange({ ...warehouse, ...patch });

  return (
    <div className="border-b border-slate-800 bg-slate-800/40">
      <button data-testid="warehouse-header" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left group">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
          <Warehouse size={15} className="text-[#F26A21]" /> Almacén y configuración
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          <AddressField label="Salida" value={start} accent="text-emerald-400" testid="wh-start"
            onSelect={(v) => update({ start: v })} />

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input data-testid="wh-same-checkbox" type="checkbox" checked={sameAsStart}
              onChange={(e) => update({ sameAsStart: e.target.checked })}
              className="accent-[#F26A21] w-4 h-4" />
            La llegada es la misma dirección de salida
          </label>

          {!sameAsStart && (
            <AddressField label="Llegada" value={end} accent="text-sky-400" testid="wh-end"
              onSelect={(v) => update({ end: v })} />
          )}

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Clock size={11} /> Tiempo en cada parada (min)
            </span>
            <input data-testid="wh-service-time" type="number" min="0" step="1" className={inputCls + " font-mono-tech"}
              placeholder="0" value={serviceTimeMin}
              onChange={(e) => update({ serviceTimeMin: e.target.value })} />
          </div>

          <button data-testid="wh-save-btn" onClick={onSave}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs py-2 rounded-md transition-colors">
            <Save size={14} /> Guardar configuración
          </button>
        </div>
      )}
    </div>
  );
};
