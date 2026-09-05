import { useState } from "react";
import { Toaster, toast } from "sonner";
import { LogOut, ArrowLeft, ShieldCheck } from "lucide-react";
import App from "../App";
import { AdminDashboard } from "./AdminDashboard";
import { RouteConfigPanel } from "./RouteConfigPanel";
import { DiarioRuta } from "./DiarioRuta";
import { EstadoRutas } from "./EstadoRutas";
import { Notificaciones } from "./Notificaciones";
import { UsersDialog } from "./UsersDialog";
import "../App.css";

const TITLES = { configs: "Configuración de rutas", diario: "Asignación de Ruta", estado: "Estado rutas", notificaciones: "Notificaciones" };

export const AdminApp = ({ user, onLogout }) => {
  const [screen, setScreen] = useState("dashboard");
  const [driversOpen, setDriversOpen] = useState(false);

  const open = (key) => {
    if (key === "conductores") { setDriversOpen(true); return; }
    setScreen(key);
  };

  if (screen === "simulacion") {
    return <App user={user} onLogout={onLogout} onBack={() => setScreen("dashboard")} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Toaster theme="dark" position="top-center" richColors />
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-3 z-20">
        <div className="flex items-center gap-2 min-w-0">
          {screen !== "dashboard" ? (
            <button data-testid="admin-back" onClick={() => setScreen("dashboard")} className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-md flex items-center justify-center shrink-0 text-slate-200"><ArrowLeft size={17} /></button>
          ) : (
            <div className="w-8 h-8 bg-[#F26A21] rounded-md flex items-center justify-center shrink-0"><ShieldCheck size={17} className="text-white" /></div>
          )}
          <div className="min-w-0">
            <div className="text-white font-bold text-sm truncate">{TITLES[screen] || "Administrador"}</div>
            <div className="text-[10px] text-slate-400 truncate">{user?.nombres || user?.username}</div>
          </div>
        </div>
        <button data-testid="admin-logout-top" onClick={onLogout} className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-md"><LogOut size={14} /> Salir</button>
      </header>

      {screen === "dashboard" && (
        <AdminDashboard
          adminName={user?.nombres || user?.username}
          onOpen={open}
          onSoon={(label) => toast.info(`${label}: Próximamente`)}
          onLogout={onLogout}
        />
      )}
      {screen === "configs" && <RouteConfigPanel />}
      {screen === "diario" && <DiarioRuta />}
      {screen === "estado" && <EstadoRutas />}
      {screen === "notificaciones" && <Notificaciones />}

      <UsersDialog open={driversOpen} onClose={() => setDriversOpen(false)} />
    </div>
  );
};
