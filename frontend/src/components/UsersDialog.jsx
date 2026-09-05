import { useEffect, useState } from "react";
import { X, Users, UserPlus, Trash2, Pencil, ArrowLeft, Save, MessageCircle, ShieldCheck } from "lucide-react";
import { listUsers, createUser, updateUser, removeUser } from "../lib/api";
import { toast } from "sonner";

const EMPTY = { username: "", password: "", is_admin: false, baja: false, nombres: "", apellidos: "", dni: "", telefono: "", marca: "", modelo: "", anio: "", matricula: "", cierre_seguridad: false, capacidad: "L3H2", tipologia: "", color: "" };
const CAPS = ["L1H1", "L2H2", "L3H2", "L4H3"];
const inp = "w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21]";

const waLink = (tel, username, password) => {
  let p = (tel || "").replace(/\D/g, "");
  if (p.length === 9) p = "34" + p;
  const msg =
    `BoxLogic - Acceso conductor\n` +
    `Usuario: ${username}\n` +
    `Contraseña: ${password || "(la asignada al registrarte)"}`;
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
};

const F = ({ label, k, form, set, type = "text" }) => (
  <div>
    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">{label}</label>
    <input data-testid={`user-${k}`} type={type} className={inp} value={form[k]} onChange={(e) => set(k, e.target.value)} />
  </div>
);

export const UsersDialog = ({ open, onClose }) => {
  const [users, setUsers] = useState([]);
  const [mode, setMode] = useState("list");
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const refresh = () => listUsers().then(setUsers).catch(() => toast.error("No se pudieron cargar"));
  useEffect(() => { if (open) { setMode("list"); refresh(); } }, [open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.username.trim() || (!editId && !form.password.trim())) { toast.error("Usuario y contraseña obligatorios"); return; }
    try {
      if (editId) { const p = { ...form }; if (!p.password) delete p.password; await updateUser(editId, p); toast.success("Usuario actualizado"); }
      else { await createUser(form); toast.success(form.is_admin ? "Administrador creado" : "Conductor creado"); }
      setMode("list"); refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error al guardar"); }
  };
  const del = async (id) => { try { await removeUser(id); setUsers((u) => u.filter((x) => x.id !== id)); toast.success("Eliminado"); } catch { toast.error("Error"); } };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl" data-testid="users-dialog">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-head text-lg font-bold text-white flex items-center gap-2">
            {mode === "form" && <button onClick={() => setMode("list")} className="text-slate-400 hover:text-white mr-1"><ArrowLeft size={18} /></button>}
            <Users size={20} className="text-[#F26A21]" />{mode === "form" ? (editId ? "Editar conductor" : "Nuevo conductor") : "Conductores"}
          </h3>
          <button onClick={onClose} data-testid="close-users-dialog" className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {mode === "list" ? (
          <>
            <div className="p-4 overflow-y-auto thin-scroll flex-1">
              {users.length === 0 ? <p className="text-slate-500 text-center py-10">No hay conductores.</p> :
                users.map((d) => (
                  <div key={d.id} data-testid={`user-row-${d.id}`} className="border border-slate-700 rounded-md p-3 mb-2 flex items-center justify-between hover:border-slate-500">
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate flex items-center gap-2">
                        {d.nombres} {d.apellidos} <span className="text-slate-500 font-mono-tech text-xs">({d.username})</span>
                        {d.role === "admin" && <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-[#F26A21] bg-[#F26A21]/15 border border-[#F26A21]/40 px-1.5 py-0.5 rounded"><ShieldCheck size={10} /> Admin</span>}
                        {d.baja && <span className="inline-flex items-center text-[9px] font-bold uppercase text-red-400 bg-red-500/15 border border-red-500/40 px-1.5 py-0.5 rounded">Baja</span>}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{d.role === "admin" ? "Administrador" : [d.marca, d.modelo, d.anio, d.matricula, d.capacidad, d.color].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <a data-testid={`wa-${d.id}`} href={waLink(d.telefono, d.username, d.password_plain || "")} target="_blank" rel="noreferrer" className="text-green-500 hover:text-green-400" title="Enviar acceso por WhatsApp"><MessageCircle size={17} /></a>
                      <button data-testid={`edit-user-${d.id}`} onClick={() => { setForm({ ...EMPTY, ...d, password: "" }); setEditId(d.id); setMode("form"); }} className="text-slate-400 hover:text-white"><Pencil size={16} /></button>
                      <button data-testid={`del-user-${d.id}`} onClick={() => del(d.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
            </div>
            <div className="p-4 border-t border-slate-700">
              <button data-testid="add-user-btn" onClick={() => { setForm(EMPTY); setEditId(null); setMode("form"); }} className="w-full flex items-center justify-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold py-2.5 rounded-sm"><UserPlus size={16} /> Agregar conductor</button>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 overflow-y-auto thin-scroll flex-1 space-y-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Acceso (numérico)</p>
              <div className="grid grid-cols-2 gap-3">
                <F label="Usuario" k="username" form={form} set={set} />
                <F label={editId ? "Contraseña (dejar vacío = mantener)" : "Contraseña"} k="password" form={form} set={set} />
              </div>
              <label data-testid="user-is-admin" className="flex items-center gap-2.5 cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5">
                <input type="checkbox" checked={!!form.is_admin} onChange={(e) => set("is_admin", e.target.checked)} className="w-4 h-4 accent-[#F26A21]" disabled={!!editId} />
                <ShieldCheck size={16} className="text-[#F26A21]" />
                <span className="text-sm text-white font-semibold">Es administrador</span>
                <span className="text-xs text-slate-500 ml-auto">acceso al panel de gestión</span>
              </label>
              <label data-testid="user-baja" className="flex items-center gap-2.5 cursor-pointer rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5">
                <input type="checkbox" checked={!!form.baja} onChange={(e) => set("baja", e.target.checked)} className="w-4 h-4 accent-red-500" />
                <span className="text-sm text-white font-semibold">Baja</span>
                <span className="text-xs text-slate-500 ml-auto">si está marcado, no puede entrar</span>
              </label>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Datos personales</p>
              <div className="grid grid-cols-2 gap-3">
                <F label="Nombres" k="nombres" form={form} set={set} />
                <F label="Apellidos" k="apellidos" form={form} set={set} />
                <F label="DNI/NIE" k="dni" form={form} set={set} />
                <F label="Teléfono" k="telefono" form={form} set={set} />
              </div>
              {!form.is_admin && (<>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Furgón</p>
              <div className="grid grid-cols-2 gap-3">
                <F label="Marca" k="marca" form={form} set={set} />
                <F label="Modelo" k="modelo" form={form} set={set} />
                <F label="Año" k="anio" form={form} set={set} />
                <F label="Matrícula" k="matricula" form={form} set={set} />
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Capacidad</label>
                  <select data-testid="user-capacidad" className={inp} value={form.capacidad} onChange={(e) => set("capacidad", e.target.value)}>
                    {CAPS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <F label="Tipología" k="tipologia" form={form} set={set} />
                <F label="Color" k="color" form={form} set={set} />
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Cierre seguridad</label>
                  <select data-testid="user-cierre" className={inp} value={form.cierre_seguridad ? "SI" : "NO"} onChange={(e) => set("cierre_seguridad", e.target.value === "SI")}>
                    <option value="NO">NO</option><option value="SI">SI</option>
                  </select>
                </div>
              </div>
              </>)}
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-between gap-2">
              <a data-testid="form-wa" href={waLink(form.telefono, form.username, form.password)} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm font-bold text-green-500 hover:text-green-400 px-3 py-2"><MessageCircle size={16} /> WhatsApp acceso</a>
              <button data-testid="save-user-btn" onClick={save} className="flex items-center gap-2 bg-[#F26A21] hover:bg-[#f58220] text-white font-bold text-sm px-5 py-2 rounded-sm"><Save size={15} /> Guardar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
