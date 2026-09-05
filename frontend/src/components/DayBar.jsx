import { CalendarDays, Lock } from "lucide-react";

export const fmtDate = (d) => {
  try {
    const [y, m, day] = d.split("-").map(Number);
    const s = new Date(y, m - 1, day).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch { return d; }
};

export const DayBar = ({ date, today, editable, dates = [], onChange }) => (
  <div className="shrink-0 flex items-center justify-between gap-2 bg-slate-900 border-b border-slate-700 px-3 py-2">
    <div className="flex items-center gap-2 min-w-0">
      <CalendarDays size={16} className="text-[#F26A21] shrink-0" />
      <span data-testid="day-date" className="text-xs font-bold text-white truncate">{date ? fmtDate(date) : ""}</span>
      {!editable && <span className="text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1 shrink-0"><Lock size={11} /> Solo lectura</span>}
    </div>
    {dates.length > 1 && (
      <select
        data-testid="day-select"
        value={date || ""}
        onChange={(e) => onChange(e.target.value)}
        className="shrink-0 bg-slate-800 border border-slate-600 text-white text-xs font-semibold rounded-md px-2 py-1 outline-none focus:border-[#F26A21]"
      >
        {dates.map((d) => (
          <option key={d} value={d}>{d === today ? "Hoy" : d}</option>
        ))}
      </select>
    )}
  </div>
);
