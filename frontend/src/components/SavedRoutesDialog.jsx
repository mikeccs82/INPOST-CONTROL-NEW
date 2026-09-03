import { useEffect, useState } from "react";
import { X, FolderOpen, Trash2, MapPin, Clock } from "lucide-react";
import { listRoutes, deleteRoute } from "../lib/api";
import { toast } from "sonner";

export const SavedRoutesDialog = ({ open, onClose, onLoad }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setRoutes(await listRoutes());
    } catch (e) {
      toast.error("No se pudieron cargar las rutas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleDelete = async (id) => {
    try {
      await deleteRoute(id);
      setRoutes((r) => r.filter((x) => x.id !== id));
      toast.success("Ruta eliminada");
    } catch (e) {
      toast.error("Error al eliminar");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="saved-routes-dialog"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-head text-lg font-bold text-white flex items-center gap-2">
            <FolderOpen size={20} className="text-[#FF6B00]" /> Rutas guardadas
          </h3>
          <button onClick={onClose} data-testid="close-saved-dialog" className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto thin-scroll flex-1">
          {loading ? (
            <p className="text-slate-400 text-sm text-center py-8">Cargando...</p>
          ) : routes.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No hay rutas guardadas todavía.</p>
          ) : (
            routes.map((r) => (
              <div
                key={r.id}
                data-testid={`saved-route-${r.id}`}
                className="border border-slate-700 rounded-md p-3 mb-2 flex items-center justify-between hover:border-slate-500 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{r.name}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><MapPin size={12} /> {r.stops.length} paradas</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {r.metric === "distance" ? "Distancia" : "Tiempo"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    data-testid={`load-route-${r.id}`}
                    onClick={() => onLoad(r)}
                    className="bg-[#FF6B00] hover:bg-[#FF8533] text-black text-xs font-bold px-3 py-1.5 rounded-sm transition-colors"
                  >
                    Cargar
                  </button>
                  <button
                    data-testid={`delete-route-${r.id}`}
                    onClick={() => handleDelete(r.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
