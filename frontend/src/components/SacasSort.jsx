import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Mic, MicOff, Search, Package, ShoppingBag, AlertTriangle, MapPin, Loader2, X, Boxes, ArrowRight, CalendarDays, Lock } from "lucide-react";
import { mySacas, saveMySacas, buildMyRoute } from "../lib/api";

const digits = (s) => String(s || "").replace(/\D/g, "");
const last4 = (s) => digits(s).slice(-4);

// Convierte números hablados en español a dígitos: "veintitrés setenta y uno" -> "2371", "cero tres tres siete" -> "0337"
const NORM = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const UNITS = { cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
const TEENS = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const TENS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };

const wordsToDigits = (text) => {
  const tokens = NORM(text).split(/[\s,.-]+/).filter(Boolean);
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\d+$/.test(t)) { out += t; continue; }
    if (t === "y") continue;
    if (t in UNITS) { out += String(UNITS[t]); continue; }
    if (t in TEENS) { out += String(TEENS[t]); continue; }
    if (t in TENS) {
      let val = TENS[t];
      if (tokens[i + 1] === "y" && tokens[i + 2] in UNITS) { val += UNITS[tokens[i + 2]]; i += 2; }
      else if (tokens[i + 1] in UNITS) { val += UNITS[tokens[i + 1]]; i += 1; }
      out += String(val);
      continue;
    }
    if (t === "cien" || t === "ciento") { out += "100"; continue; }
    // "mil" y palabras desconocidas se ignoran
  }
  return out;
};

const fmtDate = (d) => {
  try {
    const [y, m, day] = d.split("-").map(Number);
    const s = new Date(y, m - 1, day).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch { return d; }
};

export const SacasSort = ({ onNext }) => {
  const [loading, setLoading] = useState(true);
  const [stops, setStops] = useState([]);
  const [routeNumber, setRouteNumber] = useState(null);
  const [positions, setPositions] = useState([]);
  const [isolated, setIsolated] = useState([]);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(null); // {last4, kind:'new'|'existing'|'unknown', position, stopName}
  const [listening, setListening] = useState(false);
  const [building, setBuilding] = useState(false);
  const [date, setDate] = useState(null);
  const [today, setToday] = useState(null);
  const [editable, setEditable] = useState(true);
  const [dates, setDates] = useState([]);
  const recRef = useRef(null);
  const posRef = useRef(positions);
  const isoRef = useRef(isolated);
  posRef.current = positions;
  isoRef.current = isolated;

  const speechOk = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const load = useCallback((d) => {
    setLoading(true);
    setPending(null);
    mySacas(d).then((data) => {
      setStops(data.stops || []);
      setRouteNumber(data.route_number);
      setPositions(data.session?.positions || []);
      setIsolated(data.session?.isolated || []);
      setDate(data.date);
      setToday(data.today);
      setEditable(!!data.editable);
      setDates(data.dates || []);
    }).catch(() => toast.error("No se pudo cargar la información de sacas"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = useCallback((pos, iso) => {
    saveMySacas({ positions: pos, isolated: iso }).catch(() => toast.error("No se pudo guardar"));
  }, []);

  const resolve = useCallback((raw) => {
    if (!editable) { toast.error("Los días anteriores son solo lectura"); return; }
    const q = last4(raw);
    if (!q) { toast.error("No se detectó ningún número"); return; }
    const match = stops.find((s) => last4(s.order_id) === q && digits(s.order_id));
    const addr = match?.address || "";
    const existing = posRef.current.find((p) => p.last4 === q);
    if (existing) {
      setPending({ last4: q, kind: "existing", position: existing.position, stopName: existing.stop_name, stopAddress: addr });
      return;
    }
    if (match) {
      setPending({ last4: q, kind: "new", position: posRef.current.length + 1, stopName: match.name || "Parada", stopAddress: addr, stopId: match.id });
    } else {
      setPending({ last4: q, kind: "unknown", position: null, stopName: "", stopAddress: "" });
    }
  }, [stops, editable]);

  const addrOf = useCallback((q) => (stops.find((s) => last4(s.order_id) === q && digits(s.order_id))?.address || ""), [stops]);

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
      const num = wordsToDigits(t) || digits(t);
      setQuery(last4(num) || num);
      resolve(num);
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

  const nextStep = async () => {
    if (positions.length === 0) { toast.error("Primero registra al menos una parada"); return; }
    setBuilding(true);
    try {
      await buildMyRoute();
      toast.success("Ruta optimizada generada");
      onNext?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo generar la ruta");
    } finally {
      setBuilding(false);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-[#F26A21]" /></div>;

  return (
    <div data-testid="sacas-sort" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-xl font-bold text-white">Ordenar Sacas</h1>
          <button
            data-testid="sacas-next-step"
            onClick={nextStep}
            disabled={building || positions.length === 0 || !editable}
            className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-3.5 py-2 rounded-lg transition-colors"
          >
            {building ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Siguiente paso
          </button>
        </div>

        {/* Fecha del día + selector de días anteriores */}
        <div className="flex items-center justify-between gap-2 mb-3 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays size={18} className="text-[#F26A21] shrink-0" />
            <div className="min-w-0">
              <div data-testid="sacas-date" className="text-sm font-bold text-white truncate">{date ? fmtDate(date) : ""}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">{editable ? "Trabajando en hoy" : "Solo lectura"}</div>
            </div>
          </div>
          {dates.length > 1 && (
            <select
              data-testid="sacas-date-select"
              value={date || ""}
              onChange={(e) => load(e.target.value)}
              className="shrink-0 bg-slate-800 border border-slate-600 text-white text-xs font-semibold rounded-md px-2 py-1.5 outline-none focus:border-[#F26A21]"
            >
              {dates.map((d) => (
                <option key={d} value={d}>{d === today ? "Hoy" : d}</option>
              ))}
            </select>
          )}
        </div>

        <p className="text-sm text-slate-400 mb-4">
          {routeNumber ? `Ruta ${routeNumber} · ` : ""}Di o escribe los últimos 4 dígitos del ID de orden
        </p>

        {!editable && (
          <div className="mb-4 rounded-lg bg-slate-800/60 border border-slate-600 p-3 text-sm text-slate-300 flex items-center gap-2">
            <Lock size={16} className="text-slate-400" /> Estás viendo un día anterior. No puedes modificarlo.
          </div>
        )}

        {stops.length === 0 && (
          <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-300 flex items-center gap-2">
            <AlertTriangle size={16} /> No tienes paradas asignadas todavía.
          </div>
        )}

        {/* Search */}
        {editable && (
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
        )}
        {listening && <p className="text-xs text-red-400 mb-3 flex items-center gap-1.5"><Mic size={12} /> Escuchando… di el número</p>}

        {/* Pending prompt */}
        {pending && (
          <div data-testid="sacas-prompt" className="mb-4 rounded-xl border p-4 animate-in fade-in"
            style={{ borderColor: pending.kind === "unknown" ? "#f59e0b66" : "#F26A2166", backgroundColor: pending.kind === "unknown" ? "#f59e0b12" : "#F26A2112" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {pending.kind === "unknown" ? (
                  <>
                    <div className="text-4xl font-mono-tech font-extrabold text-white leading-none">{pending.last4}</div>
                    <p className="text-base font-bold text-amber-300 flex items-center gap-1.5 mt-2"><AlertTriangle size={17} /> Parada no reconocida</p>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-mono-tech text-slate-400">···{pending.last4}</div>
                    <p className="text-5xl font-extrabold text-[#F26A21] leading-none mt-1">Posición {pending.position}</p>
                    <p className="text-lg font-bold text-white mt-3 flex items-center gap-1.5"><MapPin size={17} className="shrink-0 text-[#F26A21]" /> {pending.stopName}</p>
                    {pending.stopAddress && <p className="text-sm text-slate-300 mt-0.5 pl-6">{pending.stopAddress}</p>}
                    {pending.kind === "existing" && <p className="text-[11px] text-slate-400 mt-1">Ya existente · añade a este montón</p>}
                  </>
                )}
              </div>
              <button data-testid="sacas-cancel" onClick={() => { setPending(null); setQuery(""); }} className="text-slate-400 hover:text-white shrink-0"><X size={18} /></button>
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
                <div className="text-3xl font-mono-tech font-extrabold text-white leading-none">···{p.last4}</div>
                {addrOf(p.last4) && <div className="text-xs text-slate-300 mt-1 truncate">{addrOf(p.last4)}</div>}
                <div className="text-[11px] text-slate-500 truncate">{p.stop_name}</div>
              </div>
              <div className="text-sm text-slate-300 flex flex-col items-end gap-1 shrink-0">
                <span className="flex items-center gap-1"><ShoppingBag size={14} className="text-[#F26A21]" /> {p.sacas}</span>
                <span className="flex items-center gap-1"><Package size={14} className="text-[#1E5AA8]" /> {p.bultos}</span>
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
