import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Clock, StickyNote, MessageSquare, Check, Loader2 } from "lucide-react";
import { saveStopComment } from "../lib/api";

const StopCard = ({ stop, index }) => {
  const [comment, setComment] = useState(stop.driver_comment || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = comment !== (stop.driver_comment || "");
  const win = (stop.window_from || stop.window_to)
    ? `${(stop.window_from || "—").slice(0, 5)} → ${(stop.window_to || "—").slice(0, 5)}`
    : null;

  const save = async () => {
    setSaving(true);
    try {
      await saveStopComment(stop.id, comment);
      stop.driver_comment = comment;
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      toast.error("No se pudo guardar el comentario");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid={`route-stop-${index}`} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        <div className="shrink-0 w-8 h-8 flex items-center justify-center font-mono-tech font-bold text-sm bg-[#F26A21] text-white rounded-full">{index + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white break-words">{stop.name || "Parada"}</div>
          {stop.address && (
            <div className="flex items-start gap-1.5 text-xs text-slate-400 mt-1">
              <MapPin size={13} className="shrink-0 mt-0.5" /><span className="break-words">{stop.address}</span>
            </div>
          )}
          {win && (
            <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
              <Clock size={13} className="text-[#F26A21] shrink-0" /><span className="font-mono-tech">{win}</span>
            </div>
          )}
          {stop.notes && (
            <div className="flex items-start gap-1.5 text-xs text-amber-300/90 mt-1">
              <StickyNote size={13} className="shrink-0 mt-0.5" /><span className="break-words">{stop.notes}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-3">
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
          <MessageSquare size={12} /> Comentario del conductor
        </label>
        <textarea
          data-testid={`route-stop-comment-${index}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Añade una nota sobre esta parada…"
          className="w-full text-sm bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#F26A21] resize-none placeholder:text-slate-600"
        />
        {(dirty || saved) && (
          <button
            data-testid={`route-stop-save-${index}`}
            onClick={save}
            disabled={saving || !dirty}
            className={`mt-2 flex items-center justify-center gap-1.5 w-full text-sm font-semibold py-2 rounded-lg transition-colors ${
              saved ? "bg-emerald-600 text-white" : "bg-[#F26A21] text-white hover:bg-[#e05f1a] disabled:opacity-50"
            }`}
          >
            {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando…</>
              : saved ? <><Check size={15} /> Guardado</>
              : "Guardar comentario"}
          </button>
        )}
      </div>
    </div>
  );
};

export const RouteStopsView = ({ stops, routeName }) => {
  return (
    <div data-testid="route-stops-view" className="flex-1 min-h-0 overflow-y-auto thin-scroll bg-slate-950 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">Paradas de la ruta</h1>
        <p className="text-sm text-slate-400 mb-4">{routeName || "Ruta asignada"} · {stops.length} paradas</p>
        {stops.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-12">No tienes paradas asignadas.</p>
        ) : (
          <div className="space-y-3">
            {stops.map((s, i) => <StopCard key={s.id} stop={s} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
};
