import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Mic, MicOff, Search, Package, ShoppingBag, AlertTriangle, MapPin, Loader2, X, Boxes } from "lucide-react";
import { mySacas, saveMySacas } from "../lib/api";

const digits = (s) => String(s || "").replace(/\D/g, "");
const last4 = (s) => digits(s).slice(-4);

export const SacasSort = () => {
  const [loading, setLoading] = useState(true);
  const [stops, setStops] = useState([]);
  const [routeNumber, setRouteNumber] = useState(null);
  const [positions, setPositions] = useState([]);
  const [isolated, setIsolated] = useState([]);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(null); // {last4, kind:'new'|'existing'|'unknown', position, stopName}
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const posRef = useRef(positions);
  const isoRef = useRef(isolated);
  posRef.current = positions;
  isoRef.current = isolated;

  const speechOk = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    mySacas().then((d) => {
      setStops(d.stops || []);
      setRouteNumber(d.route_number);
      setPositions(d.session?.positions || []);
      setIsolated(d.session?.isolated || []);
    }).catch(() => toast.error("No se pudo cargar la información de sacas"))
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((pos, iso) => {
    saveMySacas({ positions: pos, isolated: iso }).catch(() => toast.error("No se pudo guardar"));
  }, []);

  const resolve = useCallback((raw) => {
    const q = last4(raw);
    if (!q) { toast.error("No se detectó ningún número"); return; }
    const existing = posRef.current.find((p) => p.last4 === q);
    if (existing) {
      setPending({ last4: q, kind: "existing", position: existing.position, stopName: existing.stop_name });
      return;
    }
    const match = stops.find((s) => last4(s.order_id) === q && digits(s.order_id));
    if (match) {
      setPending({ last4: q, kind: "new", position: posRef.current.length + 1, stopName: match.name || "Parada", stopId: match.id });
    } else {
      setPending({ last4: q, kind: "unknown", position: null, stopName: "" });
    }
  }, [stops]);

  const submitText = (e) => { e.preventDefault(); resolve(query); };

  const startVoice = () => {
    if (!speechOk) { toast.error("Tu navegador no soporta voz. Escribe el número."); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const t = ev.results[0][0].transcript;
      setQuery(digits(t).slice(-4) || t);
      resolve(t);
    };
    rec.onerror = () => { toast.error("No se pudo escuchar. Inténtalo de nuevo."); setListening(false); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };
  const stopVoice = () => { recRef.current?.stop(); setListening(false); };

  const addItem = (type) => {
    if (!pending) return;
    let nextPos = positions;
    if (pending.kind === "new") {
      const entry = { position: pending.position, last4: pending.last4, stop_id: pending.stopId, stop_name: pending.stopName, sacas: 0, bultos: 0 };
      entry[type === "saca" ? "sacas" : "bultos"] = 1;
      nextPos = [...positions, entry];
    } else {
      nextPos = positions.map((p) => p.last4 === pending.last4
        ? { ...p, sacas: p.sacas + (type === "saca" ? 1 : 0), bultos: p.bultos + (type === "bulto" ? 1 : 0) }
        : p);
    }
    setPositions(nextPos);
    persist(nextPos, isoRef.current);
    toast.success(`${type === "saca" ? "Saca" : "Bulto"} → Posición ${pending.position}`);
    setPending(null);
    setQuery("");
  };

  const isolate = () => {
    if (!pending) return;
    const found = isolated.find((i) => i.last4 === pending.last4);
    const nextIso = found
      ? isolated.map((i) => i.last4 === pending.last4 ? { ...i, sacas: i.sacas + 1 } : i)
      : [...isolated, { last4: pending.last4, sacas: 1, bultos: 0 }];
    setIsolated(nextIso);
    persist(posRef.current, nextIso);
    toast.info(`Aislada: ${pending.last4} (no reconocida)`);
    setPending(null);
    setQuery("");
  };

  const totalSacas = positions.reduce((a, p) => a + p.sacas, 0) + isolated.reduce((a, i) => a + i.sacas, 0);
  const totalBultos = positions.reduce((a, p) => a + p.bultos, 0);

  if (loading) return <div className="flex-1 flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-[#F26A21]" /></div>;

  return (
    <div data-testid="sacas-sort" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">Ordenar Sacas</h1>
        <p className="text-sm text-slate-400 mb-4">
          {routeNumber ? `Ruta ${routeNumber} · ` : ""}Di o escribe los últimos 4 dígitos del ID de orden
        </p>

        {stops.length === 0 && (
          <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-300 flex items-center gap-2">
            <AlertTriangle size={16} /> No tienes paradas asignadas todavía.
          </div>
        )}

        {/* Search */}
        <form onSubmit={submitText} className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              data-testid="sacas-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="Ej. 3644"
              className="w-full bg-slate-900 border border-slate-700 text-white text-lg font-mono-tech rounded-lg pl-9 pr-3 py-3 outline-none focus:ring-1 focus:ring-[#F26A21]"
            />
          </div>
          <button type="submit" data-testid="sacas-search-btn" className="px-4 rounded-lg bg-[#1E5AA8] hover:bg-[#184a8c] text-white font-semibold transition-colors">Buscar</button>
          <button
            type="button"
            data-testid="sacas-mic-btn"
            onClick={listening ? stopVoice : startVoice}
            className={`w-14 rounded-lg flex items-center justify-center text-white font-semibold transition-colors ${listening ? "bg-red-600 animate-pulse" : "bg-[#F26A21] hover:bg-[#f58220]"}`}
            title={speechOk ? "Buscar por voz" : "Voz no disponible"}
          >
            {listening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        </form>
        {listening && <p className="text-xs text-red-400 mb-3 flex items-center gap-1.5"><Mic size={12} /> Escuchando… di el número</p>}

        {/* Pending prompt */}
        {pending && (
          <div data-testid="sacas-prompt" className="mb-4 rounded-xl border p-4 animate-in fade-in"
            style={{ borderColor: pending.kind === "unknown" ? "#f59e0b66" : "#F26A2166", backgroundColor: pending.kind === "unknown" ? "#f59e0b12" : "#F26A2112" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-2xl font-mono-tech font-bold text-white">{pending.last4}</div>
                {pending.kind === "unknown" ? (
                  <p className="text-sm text-amber-300 flex items-center gap-1.5 mt-1"><AlertTriangle size={15} /> Parada no reconocida</p>
                ) : (
                  <>
                    <p className="text-base font-bold text-[#F26A21] mt-0.5">Posición {pending.position}</p>
                    <p className="text-xs text-slate-300 flex items-center gap-1 truncate"><MapPin size={12} /> {pending.stopName}</p>
                    {pending.kind === "existing" && <p className="text-[11px] text-slate-400 mt-0.5">Ya existente · añade a este montón</p>}
                  </>
                )}
              </div>
              <button data-testid="sacas-cancel" onClick={() => { setPending(null); setQuery(""); }} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {pending.kind === "unknown" ? (
                <button data-testid="sacas-isolate" onClick={isolate} className="col-span-2 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-lg transition-colors">
                  <AlertTriangle size={17} /> Aislar (poner aparte)
                </button>
              ) : (
                <>
                  <button data-testid="sacas-add-saca" onClick={() => addItem("saca")} className="flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-3 rounded-lg transition-colors">
                    <ShoppingBag size={17} /> Saca
                  </button>
                  <button data-testid="sacas-add-bulto" onClick={() => addItem("bulto")} className="flex items-center justify-center gap-2 bg-[#1E5AA8] hover:bg-[#184a8c] text-white font-bold py-3 rounded-lg transition-colors">
                    <Package size={17} /> Bulto
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-center">
            <div className="text-lg font-bold text-white font-mono-tech">{positions.length}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Posiciones</div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-center">
            <div className="text-lg font-bold text-white font-mono-tech">{totalSacas}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Sacas</div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-center">
            <div className="text-lg font-bold text-white font-mono-tech">{totalBultos}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Bultos</div>
          </div>
        </div>

        {/* Positions list */}
        <div className="space-y-2">
          {positions.map((p) => (
            <div key={p.position} data-testid={`sacas-pos-${p.position}`} className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 flex items-center justify-center font-mono-tech font-bold bg-[#F26A21] text-white rounded-full">{p.position}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{p.stop_name}</div>
                <div className="text-[11px] text-slate-400 font-mono-tech">···{p.last4}</div>
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-3 shrink-0">
                <span className="flex items-center gap-1"><ShoppingBag size={13} className="text-[#F26A21]" /> {p.sacas}</span>
                <span className="flex items-center gap-1"><Package size={13} className="text-[#1E5AA8]" /> {p.bultos}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Isolated */}
        {isolated.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-bold text-amber-400 flex items-center gap-1.5 mb-2"><AlertTriangle size={15} /> Aisladas / no reconocidas</h2>
            <div className="space-y-2">
              {isolated.map((i) => (
                <div key={i.last4} data-testid={`sacas-iso-${i.last4}`} className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-3 flex items-center justify-between">
                  <span className="font-mono-tech text-white">···{i.last4}</span>
                  <span className="text-xs text-amber-300">{i.sacas} saca(s)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {positions.length === 0 && isolated.length === 0 && !pending && (
          <div className="text-center text-slate-500 text-sm py-10">
            <Boxes size={28} className="mx-auto mb-2 opacity-40" />
            Empieza escaneando la primera saca.
          </div>
        )}
      </div>
    </div>
  );
};
