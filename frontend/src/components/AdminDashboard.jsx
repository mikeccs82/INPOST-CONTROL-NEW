import { useEffect, useState } from "react";
import { Route, Activity, Users, FlaskConical, LogOut, ClipboardList, Bell } from "lucide-react";
import { notificationsUnread } from "../lib/api";

const CARDS = [
  { key: "configs", label: "Configuración de rutas", icon: Route, accent: "#F26A21", soon: false },
  { key: "diario", label: "Asignación de Ruta", icon: ClipboardList, accent: "#16A34A", soon: false },
  { key: "estado", label: "Estado rutas", icon: Activity, accent: "#2563EB", soon: false },
  { key: "notificaciones", label: "Notificaciones", icon: Bell, accent: "#DC2626", soon: false },
  { key: "conductores", label: "Conductores", icon: Users, accent: "#2563EB", soon: false },
  { key: "simulacion", label: "Simulación de ruta", icon: FlaskConical, accent: "#F26A21", soon: false },
];

export const AdminDashboard = ({ onOpen, onSoon, onLogout, adminName }) => {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = () => notificationsUnread().then((r) => setUnread(r.unread || 0)).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const handle = (c) => (c.soon ? onSoon(c.label) : onOpen(c.key));
  return (
    <div data-testid="admin-dashboard" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Panel de administración</h1>
        <p className="text-sm text-slate-400 mb-5">{adminName ? `Hola, ${adminName}` : "Selecciona una sección"}</p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {CARDS.map((c) => {
            const Icon = c.icon;
            const badge = c.key === "notificaciones" && unread > 0 ? unread : null;
            return (
              <button
                key={c.key}
                data-testid={`admin-card-${c.key}`}
                onClick={() => handle(c)}
                className="relative group aspect-square sm:aspect-auto sm:py-10 rounded-2xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center gap-3 p-4 transition-colors duration-200 hover:border-slate-500 active:scale-[0.98]"
              >
                {c.soon && (
                  <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded">
                    Próximamente
                  </span>
                )}
                {badge != null && (
                  <span data-testid="notif-badge" className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-bold text-white bg-red-600 rounded-full shadow-lg animate-pulse">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${c.accent}1A`, border: `1px solid ${c.accent}55` }}>
                  <Icon size={30} style={{ color: c.accent }} />
                </div>
                <span className="text-sm sm:text-base font-semibold text-white text-center leading-tight">{c.label}</span>
              </button>
            );
          })}
        </div>

        <button data-testid="admin-logout" onClick={onLogout}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-red-600/90 hover:bg-red-600 text-white font-bold text-base py-4 transition-colors duration-200 active:scale-[0.99]">
          <LogOut size={20} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
};
