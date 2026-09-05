import { Info, ArrowRight } from "lucide-react";

export const CargaVehiculo = ({ onNext }) => {
  return (
    <div data-testid="carga-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <style>{`
        @keyframes cv-drivein { 0% { transform: translateX(-160%); } 70% { transform: translateX(2%); } 100% { transform: translateX(0); } }
        @keyframes cv-bob { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-2.5px) rotate(-.3deg); } }
        @keyframes cv-spin { to { transform: rotate(360deg); } }
        @keyframes cv-road { to { stroke-dashoffset: -60; } }
        @keyframes cv-road2 { to { stroke-dashoffset: -30; } }
        @keyframes cv-pulse { 0%,100% { opacity:.3; transform: scale(1); } 50% { opacity:.7; transform: scale(1.04); } }
        @keyframes cv-arrow { 0%,100% { transform: translateY(0); opacity:.7; } 50% { transform: translateY(-7px); opacity:1; } }
        @keyframes cv-speed { 0% { opacity:0; transform: translateX(20px);} 30%{opacity:.8;} 100% { opacity:0; transform: translateX(-90px);} }
        @keyframes cv-smoke { 0% { opacity:.5; transform: translate(0,0) scale(.5);} 100% { opacity:0; transform: translate(-26px,-16px) scale(1.6);} }
        @keyframes cv-shadow { 0%,100% { transform: scaleX(1); opacity:.32; } 50% { transform: scaleX(.94); opacity:.24; } }
        @keyframes cv-head { 0%,100%{opacity:.5;} 50%{opacity:.9;} }
        .cv-van { animation: cv-drivein 1.1s cubic-bezier(.22,1,.36,1) both; }
        .cv-bob { animation: cv-bob 1.6s ease-in-out infinite 1s; transform-origin: 150px 150px; }
        .cv-wheel { animation: cv-spin 1.1s linear infinite; transform-box: fill-box; transform-origin: center; }
        .cv-shadow { animation: cv-shadow 1.6s ease-in-out infinite 1s; transform-box: fill-box; transform-origin: center; }
      `}</style>

      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">Carga del vehículo</h1>
        <p className="text-xs font-bold uppercase tracking-wider text-[#2563EB] mb-5">Paso 3</p>

        <div className="rounded-2xl border border-slate-700 p-4 mb-4 overflow-hidden"
          style={{ background: "linear-gradient(180deg,#1b2740 0%,#0d1526 100%)" }}>
          <svg viewBox="0 0 420 240" className="w-full h-auto" role="img" aria-label="Furgoneta">
            <defs>
              <linearGradient id="cvBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3b82f6" /><stop offset="0.5" stopColor="#2563EB" /><stop offset="1" stopColor="#1a4bb0" />
              </linearGradient>
              <linearGradient id="cvCab" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fb8c3c" /><stop offset="1" stopColor="#e85f14" />
              </linearGradient>
              <linearGradient id="cvGlass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#dbeeff" /><stop offset="1" stopColor="#8ec5f0" />
              </linearGradient>
              <radialGradient id="cvHead" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#fde68a" stopOpacity="0.9" /><stop offset="1" stopColor="#fde68a" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="cvRim" cx="0.4" cy="0.4" r="0.6">
                <stop offset="0" stopColor="#e2e8f0" /><stop offset="1" stopColor="#64748b" />
              </radialGradient>
            </defs>

            {/* sky glow / stars subtle */}
            <circle cx="60" cy="40" r="1.5" fill="#64748b" opacity="0.5" />
            <circle cx="120" cy="26" r="1.2" fill="#64748b" opacity="0.4" />
            <circle cx="330" cy="34" r="1.4" fill="#64748b" opacity="0.4" />

            {/* speed lines */}
            {[70, 96, 120].map((y, i) => (
              <line key={y} x1="360" y1={y} x2="410" y2={y} stroke="#38bdf8" strokeWidth="3" strokeLinecap="round"
                style={{ animation: `cv-speed 0.9s linear infinite`, animationDelay: `${i * 0.25}s`, opacity: 0 }} />
            ))}

            {/* Road */}
            <rect x="0" y="196" width="420" height="44" fill="#0b1220" />
            <line x1="0" y1="200" x2="420" y2="200" stroke="#475569" strokeWidth="3" />
            <line className="cv-van" x1="0" y1="212" x2="420" y2="212" stroke="#F26A21" strokeWidth="4"
              strokeDasharray="30 30" opacity="0.55" style={{ animation: "cv-road 0.9s linear infinite" }} />
            <line x1="0" y1="224" x2="420" y2="224" stroke="#334155" strokeWidth="2" strokeDasharray="14 14"
              style={{ animation: "cv-road2 1.3s linear infinite" }} opacity="0.5" />

            {/* ground shadow */}
            <ellipse className="cv-shadow" cx="185" cy="196" rx="150" ry="10" fill="#000" opacity="0.3" />

            {/* smoke */}
            {[0, 0.5, 1].map((d) => (
              <circle key={d} cx="40" cy="176" r="6" fill="#94a3b8"
                style={{ animation: `cv-smoke 1.4s ease-out infinite`, animationDelay: `${1 + d}s`, opacity: 0 }} />
            ))}

            <g className="cv-van">
              <g className="cv-bob">
                {/* Cargo box */}
                <rect x="40" y="58" width="232" height="108" rx="12" fill="url(#cvBody)" stroke="#1e40af" strokeWidth="2" />
                {/* side panel line + rivets */}
                <line x1="52" y1="112" x2="262" y2="112" stroke="#1e40af" strokeWidth="2" opacity="0.5" />
                <rect x="52" y="70" width="150" height="30" rx="4" fill="#ffffff" opacity="0.06" />
                {/* rear door split + handle */}
                <line x1="46" y1="64" x2="46" y2="160" stroke="#1e40af" strokeWidth="2" opacity="0.5" />
                <rect x="52" y="120" width="4" height="18" rx="2" fill="#0f2a66" />
                {/* taillight */}
                <rect x="40" y="150" width="6" height="12" rx="2" fill="#ef4444" />

                {/* Cabin */}
                <path d="M272 76 h50 a12 12 0 0 1 9 4 l22 34 a14 14 0 0 1 3 8 v36 a6 6 0 0 1 -6 6 h-78 z"
                  fill="url(#cvCab)" stroke="#c85110" strokeWidth="2" />
                {/* windshield */}
                <path d="M312 82 h20 a6 6 0 0 1 5 3 l15 24 h-40 z" fill="url(#cvGlass)" />
                <path d="M314 84 l10 0 l-6 24 l-6 0 z" fill="#ffffff" opacity="0.35" />
                {/* door line + mirror */}
                <line x1="312" y1="82" x2="312" y2="164" stroke="#c85110" strokeWidth="2" opacity="0.6" />
                <rect x="356" y="120" width="6" height="10" rx="2" fill="#7c3a0c" />
                {/* headlight + glow */}
                <ellipse cx="392" cy="150" rx="26" ry="16" fill="url(#cvHead)" style={{ animation: "cv-head 1.6s ease-in-out infinite" }} />
                <rect x="356" y="146" width="8" height="12" rx="2" fill="#fde047" />

                {/* Pickup zone (front-lateral) */}
                <g>
                  <rect x="204" y="70" width="60" height="80" rx="6" fill="#22c55e"
                    style={{ animation: "cv-pulse 1.6s ease-in-out infinite", transformOrigin: "234px 110px" }} opacity="0.35" />
                  <rect x="204" y="70" width="60" height="80" rx="6" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeDasharray="7 5" />
                  {/* parcels (pseudo-3d) */}
                  <g>
                    <polygon points="214,132 232,132 236,126 218,126" fill="#fcd34d" />
                    <rect x="214" y="132" width="18" height="14" fill="#eab308" /><rect x="232" y="126" width="4" height="20" fill="#ca8a04" />
                    <polygon points="236,132 252,132 256,126 240,126" fill="#fcd34d" />
                    <rect x="236" y="132" width="16" height="14" fill="#eab308" /><rect x="252" y="126" width="4" height="20" fill="#ca8a04" />
                    <polygon points="222,116 240,116 244,110 226,110" fill="#fbbf24" />
                    <rect x="222" y="116" width="18" height="14" fill="#f59e0b" /><rect x="240" y="110" width="4" height="20" fill="#d97706" />
                  </g>
                  {/* arrow */}
                  <g style={{ animation: "cv-arrow 1.4s ease-in-out infinite" }}>
                    <line x1="234" y1="30" x2="234" y2="58" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" />
                    <path d="M224 52 l10 12 l10 -12" fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </g>

                {/* Wheels */}
                {[100, 300].map((cx) => (
                  <g key={cx}>
                    <circle cx={cx} cy="176" r="26" fill="#111827" stroke="#1f2937" strokeWidth="3" />
                    <circle cx={cx} cy="176" r="26" fill="none" stroke="#374151" strokeWidth="4" strokeDasharray="4 6" />
                    <g className="cv-wheel" style={{ transformOrigin: `${cx}px 176px` }}>
                      <circle cx={cx} cy="176" r="13" fill="url(#cvRim)" stroke="#475569" strokeWidth="1.5" />
                      {[0, 60, 120].map((a) => (
                        <line key={a} x1={cx} y1="163" x2={cx} y2="189" stroke="#94a3b8" strokeWidth="3"
                          transform={`rotate(${a} ${cx} 176)`} />
                      ))}
                      <circle cx={cx} cy="176" r="4" fill="#1e293b" />
                    </g>
                  </g>
                ))}
              </g>
            </g>
          </svg>
          <div className="text-center mt-1">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wide text-green-400 bg-green-500/10 border border-green-500/30 px-2.5 py-0.5 rounded-full">
              Zona de recogidas
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/30 p-4 flex gap-3">
          <Info size={22} className="text-[#2563EB] shrink-0 mt-0.5" />
          <p className="text-sm text-slate-200 leading-relaxed">
            Recuerda dejar un <span className="font-bold text-white">espacio en la parte delantera lateral</span> para dejar las <span className="font-bold text-green-400">recogidas</span>.
          </p>
        </div>

        <button data-testid="carga-next-step" onClick={onNext}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base py-3.5 rounded-xl transition-colors active:scale-[0.99]">
          Siguiente <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
