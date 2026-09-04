import { useState } from "react";
import { Truck, LogIn, Loader2 } from "lucide-react";
import { authLogin } from "../lib/api";

export const LoginScreen = ({ onAuthed }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await authLogin(username.trim(), password.trim());
      localStorage.setItem("token", data.token);
      onAuthed(data.user);
    } catch (e2) {
      setErr("Usuario o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6" data-testid="login-form">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-[#F26A21] flex items-center justify-center mb-3">
            <Truck size={28} className="text-white" />
          </div>
          <h1 className="font-head text-2xl font-extrabold text-white">BoxLogic</h1>
          <p className="text-xs text-slate-400 uppercase tracking-[0.2em]">Optimizador de rutas</p>
        </div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Usuario</label>
        <input data-testid="login-username" inputMode="numeric" value={username} onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 text-white text-lg font-mono-tech rounded-md px-3 py-2.5 mb-3 outline-none focus:ring-1 focus:ring-[#F26A21]" placeholder="00000000" />
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Contraseña</label>
        <input data-testid="login-password" type="password" inputMode="numeric" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 text-white text-lg font-mono-tech rounded-md px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#F26A21]" placeholder="••••••" />
        {err && <p data-testid="login-error" className="text-red-400 text-sm mt-3">{err}</p>}
        <button data-testid="login-submit" type="submit" disabled={loading}
          className="w-full mt-5 flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-extrabold py-3 rounded-md transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />} Entrar
        </button>
      </form>
    </div>
  );
};
