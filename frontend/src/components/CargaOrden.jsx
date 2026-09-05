import { Info, Hand } from "lucide-react";

export const CargaOrden = ({ count = 4 }) => {
  const n = Math.max(2, Math.min(count || 4, 6));
  // Slots left(door)->right(front). Stop 1 nearest door (left), stop n deepest (right, junto a recogidas).
  const boxW = 26, gap = 6, startX = 44;
  const boxes = Array.from({ length: n }, (_, idx) => {
    const stop = idx + 1;                 // 1 = primera parada
    const x = startX + idx * (boxW + gap);
    const delay = (n - stop) * 0.55;      // se cargan de la última (n) a la primera (1)
    return { stop, x, delay };
  });

  return (
    <div data-testid="carga-orden-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <style>{`
        @keyframes co-load { 0% { opacity:0; transform: translateY(-26px); } 60% { opacity:1; transform: translateY(4px); } 100% { opacity:1; transform: translateY(0); } }
        @keyframes co-spin { to { transform: rotate(360deg); } }
        @keyframes co-hand { 0%,100% { opacity:0; } 40%,80% { opacity:1; } }
        .co-box { animation: co-load .55s cubic-bezier(.34,1.4,.5,1) both; }
        .co-wheel { animation: co-spin 4s linear infinite; transform-box: fill-box; transform-origin: center; }
      `}</style>

      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">Orden de carga</h1>
        <p className="text-xs font-bold uppercase tracking-wider text-[#2563EB] mb-5">Paso 3</p>

        <div className="rounded-2xl bg-slate-900 border border-slate-700 p-4 mb-4">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1 px-1">
            <span>◄ Puerta trasera (1ª parada)</span>
            <span>Frente ►</span>
          </div>
          <svg viewBox="0 0 340 180" className="w-full h-auto" role="img" aria-label="Orden de carga">
            {/* Cargo box */}
            <rect x="24" y="24" width="240" height="104" rx="10" fill="#0f172a" stroke="#334155" strokeWidth="2" />
            {/* Cabin */}
            <path d="M264 44 h34 a8 8 0 0 1 6 3 l14 22 a10 10 0 0 1 2 6 v30 a6 6 0 0 1 -6 6 h-50 z"
              fill="#F26A21" opacity="0.85" />
            {/* Reserved pickup zone (front-lateral) */}
            <rect x="228" y="34" width="30" height="84" rx="5" fill="#22c55e" opacity="0.18" stroke="#22c55e" strokeWidth="2" strokeDasharray="5 4" />
            <text x="243" y="128" textAnchor="middle" fontSize="8" fontWeight="700" fill="#22c55e">RECOG.</text>

            {/* Boxes loaded last->first */}
            {boxes.map((b) => (
              <g key={b.stop} className="co-box" style={{ animationDelay: `${b.delay}s` }}>
                <rect x={b.x} y={72} width={boxW} height={boxW + 12} rx="3"
                  fill={b.stop === 1 ? "#F26A21" : "#eab308"} stroke={b.stop === 1 ? "#f58220" : "#a16207"} strokeWidth="1.5" />
                <text x={b.x + boxW / 2} y={72 + (boxW + 12) / 2 + 4} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">{b.stop}</text>
              </g>
            ))}

            {/* Hand pointing to stop 1 (a mano) */}
            <g style={{ animation: "co-hand 2s ease-in-out infinite", animationDelay: `${n * 0.55}s` }}>
              <text x={startX + boxW / 2} y="150" textAnchor="middle" fontSize="8" fontWeight="700" fill="#F26A21">A MANO</text>
            </g>

            {/* Wheels */}
            <g><circle cx="80" cy="140" r="16" fill="#0f172a" stroke="#475569" strokeWidth="3" />
              <g className="co-wheel" style={{ transformOrigin: "80px 140px" }}><line x1="80" y1="126" x2="80" y2="154" stroke="#334155" strokeWidth="3" /><line x1="66" y1="140" x2="94" y2="140" stroke="#334155" strokeWidth="3" /></g></g>
            <g><circle cx="250" cy="140" r="16" fill="#0f172a" stroke="#475569" strokeWidth="3" />
              <g className="co-wheel" style={{ transformOrigin: "250px 140px" }}><line x1="250" y1="126" x2="250" y2="154" stroke="#334155" strokeWidth="3" /><line x1="236" y1="140" x2="264" y2="140" stroke="#334155" strokeWidth="3" /></g></g>
          </svg>
          <div className="text-center mt-1">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wide text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">
              Se carga de la última (n) a la primera (1)
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/30 p-4 flex gap-3">
          <Info size={22} className="text-[#2563EB] shrink-0 mt-0.5" />
          <p className="text-sm text-slate-200 leading-relaxed">
            Carga <span className="font-bold text-white">respetando el espacio de recogidas</span> y hazlo desde la <span className="font-bold text-white">última parada hasta la primera</span>. Así, al salir a ruta, la <span className="font-bold text-[#F26A21]">parada 1 queda a mano</span> y todo va ya ordenado.
          </p>
        </div>
      </div>
    </div>
  );
};
