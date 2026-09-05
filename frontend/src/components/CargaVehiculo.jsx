import { Info } from "lucide-react";

export const CargaVehiculo = () => {
  return (
    <div data-testid="carga-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <style>{`
        @keyframes cv-drivein { 0% { transform: translateX(-140%); } 100% { transform: translateX(0); } }
        @keyframes cv-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes cv-spin { to { transform: rotate(360deg); } }
        @keyframes cv-road { to { stroke-dashoffset: -48; } }
        @keyframes cv-pulse { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
        @keyframes cv-arrow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .cv-van { animation: cv-drivein 1s cubic-bezier(.22,1,.36,1) both; transform-origin: center; }
        .cv-bob { animation: cv-bounce 1.1s ease-in-out infinite .9s; }
        .cv-wheel { animation: cv-spin 1.1s linear infinite; transform-box: fill-box; transform-origin: center; }
        .cv-road { animation: cv-road 1s linear infinite; }
        .cv-zone { animation: cv-pulse 1.4s ease-in-out infinite; }
        .cv-arrow { animation: cv-arrow 1.4s ease-in-out infinite; }
      `}</style>

      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">Carga del vehículo</h1>
        <p className="text-xs font-bold uppercase tracking-wider text-[#2563EB] mb-5">Paso 3</p>

        <div className="rounded-2xl bg-slate-900 border border-slate-700 p-4 mb-4">
          <svg viewBox="0 0 400 210" className="w-full h-auto" role="img" aria-label="Furgoneta">
            {/* Road */}
            <line x1="0" y1="192" x2="400" y2="192" stroke="#334155" strokeWidth="4" />
            <line className="cv-road" x1="0" y1="192" x2="400" y2="192" stroke="#F26A21" strokeWidth="3"
              strokeDasharray="24 24" opacity="0.5" />

            <g className="cv-van">
              <g className="cv-bob">
                {/* Cargo box */}
                <rect x="34" y="60" width="230" height="100" rx="10" fill="#1E5AA8" stroke="#2b6fca" strokeWidth="2" />
                {/* Cabin (front, right) */}
                <path d="M264 78 h56 a10 10 0 0 1 8 4 l20 30 a12 12 0 0 1 2 7 v41 a6 6 0 0 1 -6 6 h-80 z"
                  fill="#F26A21" stroke="#f58220" strokeWidth="2" />
                {/* Windshield */}
                <path d="M300 84 h20 l16 24 h-36 z" fill="#bfe3ff" opacity="0.9" />
                {/* Front bumper/light */}
                <rect x="350" y="150" width="8" height="12" rx="2" fill="#fbbf24" />

                {/* Highlighted pickup zone: front-lateral part of cargo (near cabin) */}
                <g>
                  <rect className="cv-zone" x="196" y="72" width="60" height="76" rx="6"
                    fill="#22c55e" opacity="0.35" />
                  <rect x="196" y="72" width="60" height="76" rx="6" fill="none"
                    stroke="#22c55e" strokeWidth="2.5" strokeDasharray="6 5" />
                  {/* little parcels stacked */}
                  <rect x="206" y="118" width="20" height="20" rx="2" fill="#eab308" stroke="#a16207" strokeWidth="1.5" />
                  <rect x="228" y="118" width="18" height="20" rx="2" fill="#eab308" stroke="#a16207" strokeWidth="1.5" />
                  <rect x="214" y="98" width="20" height="18" rx="2" fill="#f59e0b" stroke="#a16207" strokeWidth="1.5" />
                  {/* down arrow pointing to the zone */}
                  <g className="cv-arrow">
                    <line x1="226" y1="30" x2="226" y2="58" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
                    <path d="M216 52 l10 12 l10 -12" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </g>

                {/* Wheels */}
                <g>
                  <circle cx="90" cy="168" r="22" fill="#0f172a" stroke="#475569" strokeWidth="3" />
                  <g className="cv-wheel" style={{ transformOrigin: "90px 168px" }}>
                    <circle cx="90" cy="168" r="9" fill="#64748b" />
                    <line x1="90" y1="150" x2="90" y2="186" stroke="#334155" strokeWidth="3" />
                    <line x1="72" y1="168" x2="108" y2="168" stroke="#334155" strokeWidth="3" />
                  </g>
                </g>
                <g>
                  <circle cx="300" cy="168" r="22" fill="#0f172a" stroke="#475569" strokeWidth="3" />
                  <g className="cv-wheel" style={{ transformOrigin: "300px 168px" }}>
                    <circle cx="300" cy="168" r="9" fill="#64748b" />
                    <line x1="300" y1="150" x2="300" y2="186" stroke="#334155" strokeWidth="3" />
                    <line x1="282" y1="168" x2="318" y2="168" stroke="#334155" strokeWidth="3" />
                  </g>
                </g>
              </g>
            </g>
          </svg>
          <div className="text-center -mt-1">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wide text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded">
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
      </div>
    </div>
  );
};
