import { Info } from "lucide-react";

export const CargaOrden = ({ count = 4 }) => {
  const n = Math.max(2, Math.min(count || 4, 6));
  const areaX = 44, areaW = 208;
  const boxW = Math.min(34, (areaW - (n - 1) * 6) / n);
  const gap = n > 1 ? (areaW - n * boxW) / (n - 1) : 0;
  const baseY = 138, boxH = 40, depth = 9;

  const boxes = Array.from({ length: n }, (_, idx) => {
    const stop = idx + 1;                     // 1 = primera parada (puerta)
    const x = areaX + idx * (boxW + gap);
    const delay = (n - stop) * 0.5;           // se carga de la última (n) a la primera (1)
    return { stop, x, delay };
  });

  return (
    <div data-testid="carga-orden-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <style>{`
        @keyframes co-load { 0%{opacity:0; transform: translateY(-40px);} 65%{opacity:1; transform: translateY(5px);} 100%{opacity:1; transform: translateY(0);} }
        @keyframes co-glow { 0%,100%{ filter: drop-shadow(0 0 0 rgba(242,106,33,0)); } 50%{ filter: drop-shadow(0 0 6px rgba(242,106,33,.9)); } }
        @keyframes co-spin { to { transform: rotate(360deg); } }
        @keyframes co-hand { 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-5px); } }
        .co-box { animation: co-load .6s cubic-bezier(.34,1.5,.5,1) both; }
        .co-wheel { animation: co-spin 4s linear infinite; transform-box: fill-box; transform-origin: center; }
        .co-hand { animation: co-hand 1.4s ease-in-out infinite; }
      `}</style>

      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">Orden de carga</h1>
        <p className="text-xs font-bold uppercase tracking-wider text-[#2563EB] mb-5">Paso 3</p>

        <div className="rounded-2xl border border-slate-700 p-4 mb-4 overflow-hidden"
          style={{ background: "linear-gradient(180deg,#20304d 0%,#0f1a2e 100%)" }}>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 px-1">
            <span>◄ Puerta trasera · 1ª parada</span><span>Frente ►</span>
          </div>
          <svg viewBox="0 0 360 200" className="w-full h-auto" role="img" aria-label="Orden de carga">
            <defs>
              <linearGradient id="coFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cbd5e1" /><stop offset="1" stopColor="#94a3b8" /></linearGradient>
              <linearGradient id="coWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e2e8f0" /><stop offset="1" stopColor="#b8c2d0" /></linearGradient>
              <linearGradient id="coBox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fcd34d" /><stop offset="1" stopColor="#eab308" /></linearGradient>
              <linearGradient id="coBox1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fb8c3c" /><stop offset="1" stopColor="#e85f14" /></linearGradient>
              <radialGradient id="coRim" cx="0.4" cy="0.4" r="0.6"><stop offset="0" stopColor="#e2e8f0" /><stop offset="1" stopColor="#64748b" /></radialGradient>
            </defs>

            {/* Van body cutaway */}
            <rect x="20" y="36" width="288" height="118" rx="12" fill="url(#coWall)" stroke="#64748b" strokeWidth="2" />
            {/* floor */}
            <rect x="26" y="140" width="276" height="14" fill="url(#coFloor)" />
            {[60, 110, 160, 210, 260].map((x) => <line key={x} x1={x} y1="140" x2={x} y2="154" stroke="#7c8aa0" strokeWidth="1.5" />)}
            {/* cabin */}
            <path d="M308 52 h30 a8 8 0 0 1 6 3 l12 20 a10 10 0 0 1 2 6 v28 a6 6 0 0 1 -6 6 h-46 z" fill="#F26A21" opacity="0.9" />
            {/* rear door open indicator (left) */}
            <rect x="14" y="40" width="8" height="110" rx="3" fill="#334155" />
            <path d="M14 46 q-14 49 0 98" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />

            {/* Reserved pickup zone (front) */}
            <rect x="262" y="46" width="40" height="94" rx="6" fill="#22c55e" opacity="0.22" stroke="#15803d" strokeWidth="2" strokeDasharray="6 4" />
            <text x="282" y="93" textAnchor="middle" fontSize="8" fontWeight="700" fill="#14532d" transform="rotate(-90 282 93)">recogidas</text>
            {/* tiny pickup parcel */}
            <polygon points="272,120 288,120 291,115 275,115" fill="#4ade80" opacity="0.7" />
            <rect x="272" y="120" width="16" height="12" fill="#22c55e" opacity="0.7" />

            {/* Boxes (pseudo-3D), loaded last -> first */}
            {boxes.map((b) => {
              const top = baseY - boxH;
              const fill = b.stop === 1 ? "url(#coBox1)" : "url(#coBox)";
              const side = b.stop === 1 ? "#c85110" : "#ca8a04";
              return (
                <g key={b.stop} className={`co-box ${b.stop === 1 ? "" : ""}`} style={{ animationDelay: `${b.delay}s` }}>
                  <g style={b.stop === 1 ? { animation: "co-glow 1.6s ease-in-out infinite", animationDelay: `${(n) * 0.5}s` } : undefined}>
                    {/* top face */}
                    <polygon points={`${b.x},${top} ${b.x + boxW},${top} ${b.x + boxW + depth},${top - depth} ${b.x + depth},${top - depth}`} fill={b.stop === 1 ? "#fdba74" : "#fde68a"} />
                    {/* side face */}
                    <polygon points={`${b.x + boxW},${top} ${b.x + boxW},${top + boxH} ${b.x + boxW + depth},${top + boxH - depth} ${b.x + boxW + depth},${top - depth}`} fill={side} />
                    {/* front face */}
                    <rect x={b.x} y={top} width={boxW} height={boxH} rx="2" fill={fill} stroke={side} strokeWidth="1" />
                    {/* tape line */}
                    <line x1={b.x + boxW / 2} y1={top} x2={b.x + boxW / 2} y2={top + boxH} stroke="#00000022" strokeWidth="3" />
                    <text x={b.x + boxW / 2} y={top + boxH / 2 + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">{b.stop}</text>
                  </g>
                  {b.stop === 1 && (
                    <g className="co-hand" style={{ transformOrigin: `${b.x + boxW / 2}px 0px` }}>
                      <text x={b.x + boxW / 2} y={top + boxH + 16} textAnchor="middle" fontSize="8" fontWeight="800" fill="#F26A21">A MANO</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Wheels */}
            {[86, 268].map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy="162" r="18" fill="#111827" stroke="#1f2937" strokeWidth="3" />
                <g className="co-wheel" style={{ transformOrigin: `${cx}px 162px` }}>
                  <circle cx={cx} cy="162" r="8" fill="url(#coRim)" />
                  {[0, 60, 120].map((a) => <line key={a} x1={cx} y1="152" x2={cx} y2="172" stroke="#94a3b8" strokeWidth="2.5" transform={`rotate(${a} ${cx} 162)`} />)}
                </g>
              </g>
            ))}
          </svg>
          <div className="text-center mt-1">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wide text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
              Se carga de la última a la primera
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
