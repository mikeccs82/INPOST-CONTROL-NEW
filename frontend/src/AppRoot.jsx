import { useEffect, useState } from "react";
import { AdminApp } from "./components/AdminApp";
import { DriverApp } from "./components/DriverApp";
import { LoginScreen } from "./components/LoginScreen";
import { authMe } from "./lib/api";

export default function AppRoot() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { setLoading(false); return; }
    authMe().then(setUser).catch(() => { localStorage.removeItem("token"); }).finally(() => setLoading(false));
  }, []);

  const logout = () => { localStorage.removeItem("token"); setUser(null); };

  if (loading) return <div className="min-h-screen bg-slate-900" />;
  if (!user) return <LoginScreen onAuthed={setUser} />;
  return user.role === "admin"
    ? <AdminApp user={user} onLogout={logout} />
    : <DriverApp user={user} onLogout={logout} />;
}
