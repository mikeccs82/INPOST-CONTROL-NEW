import { Package, Route, Truck, Navigation, ClipboardList, MapPin, LogOut } from "lucide-react";

const CARDS = [
  { key: "sacas", label: "Ordenar Sacas", step: "Paso 1", icon: Package, accent: "#2563EB", soon: true },
  { key: "route", label: "Ordenar ruta", step: "Paso 2", icon: Route, accent: "#F26A21", soon: false },
  { key: "carga", label: "Carga del vehículo", step: "Paso 3", icon: Truck, accent: "#2563EB", soon: true },
  { key: "reparto", label: "Ruta a Reparto", step: "Paso 4", icon: Navigation, accent: "#F26A21", soon: true },
  { key: "datos", label: "Datos de la ruta", icon: ClipboardList, accent: "#2563EB", soon: true },
  { key: "paradas", label: "Paradas de la ruta", icon: MapPin, accent: "#F26A21", soon: true },
];

export const DriverDashboard = ({ onOpenRoute, onSoon, onLogout }) => {
  const handle = (c) => (c.soon ? onSoon(c.label) : onOpenRoute());

  return (
    <div data-testid="driver-dashboard" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">¿Qué quieres hacer?</h1>
        <p className="text-sm text-slate-400 mb-5">Selecciona una opción para comenzar</p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                data-testid={`dashboard-card-${c.key}`}
                onClick={() => handle(c)}
                className="relative group aspect-square rounded-2xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center gap-3 p-4 transition-colors duration-200 hover:border-slate-500 active:scale-[0.98]"
              >
                {c.soon && (
                  <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded">
                    Próximamente
                  </span>
                )}
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${c.accent}1A`, border: `1px solid ${c.accent}55` }}
                >
                  <Icon size={30} style={{ color: c.accent }} />
                </div>
                <span className="text-sm sm:text-base font-semibold text-white text-center leading-tight">{c.label}</span>
                {c.step && (
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: c.accent }}>({c.step})</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          data-testid="dashboard-logout"
          onClick={onLogout}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-red-600/90 hover:bg-red-600 text-white font-bold text-base py-4 transition-colors duration-200 active:scale-[0.99]"
        >
          <LogOut size={20} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
};
