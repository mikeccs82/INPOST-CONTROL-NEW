import { useEffect, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Flag, Clock, ChevronUp, ChevronDown } from "lucide-react";

const TYPE_LABELS = { P: "Particular", PD: "PUDO", L: "Locker", L24: "Locker 24h" };

export const StopList = ({ stops, onReorder, onRemove, selectedId, onSelect, onChangeType, schedule = {}, onChangeWindow, readOnlyMeta = false, canReorder = true }) => {
  const refs = useRef({});

  useEffect(() => {
    if (selectedId && refs.current[selectedId]) {
      refs.current[selectedId].scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onReorder(result.source.index, result.destination.index);
  };

  if (stops.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-12 px-4" data-testid="empty-stops">
        <Flag size={28} className="mx-auto mb-3 opacity-40" />
        No hay paradas todavía.<br />Importa un Excel o añade paradas una a una.
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="stops">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} data-testid="stop-list">
            {stops.map((s, index) => {
              const isSel = s.id === selectedId;
              const sched = schedule[s.id];
              const late = sched?.late;
              const movable = canReorder && !s.pendiente;
              return (
                <Draggable key={s.id} draggableId={String(s.id)} index={index} isDragDisabled={!movable}>
                  {(prov, snapshot) => (
                    <div
                      ref={(el) => {
                        prov.innerRef(el);
                        refs.current[s.id] = el;
                      }}
                      {...prov.draggableProps}
                      onClick={() => onSelect(s.id)}
                      data-testid={`stop-item-${index}`}
                      className={`bg-slate-800 border rounded-md p-3 mb-2 flex items-center gap-3 cursor-pointer transition-colors ${
                        snapshot.isDragging
                          ? "border-[#F26A21] shadow-lg"
                          : late
                          ? "border-red-500/70 ring-1 ring-red-500/40"
                          : isSel
                          ? "border-[#F26A21] ring-1 ring-[#F26A21]/60 bg-slate-800/90"
                          : "border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      <span {...prov.dragHandleProps} onClick={(e) => e.stopPropagation()} className={`hidden md:flex text-slate-500 ${movable ? "hover:text-white cursor-grab active:cursor-grabbing" : "opacity-30 cursor-not-allowed"}`}>
                        <GripVertical size={18} />
                      </span>
                      <div className="flex flex-col shrink-0 -my-1">
                        <button
                          data-testid={`stop-up-${index}`}
                          disabled={!movable || index === 0}
                          onClick={(e) => { e.stopPropagation(); onReorder(index, index - 1); }}
                          className="w-7 h-7 flex items-center justify-center rounded-t-md bg-slate-700 border border-slate-600 text-slate-200 disabled:opacity-25 active:bg-[#F26A21]"
                          title="Subir"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          data-testid={`stop-down-${index}`}
                          disabled={!movable || index === stops.length - 1}
                          onClick={(e) => { e.stopPropagation(); onReorder(index, index + 1); }}
                          className="w-7 h-7 flex items-center justify-center rounded-b-md bg-slate-700 border border-t-0 border-slate-600 text-slate-200 disabled:opacity-25 active:bg-[#F26A21]"
                          title="Bajar"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      <div className="shrink-0 w-8 h-8 flex items-center justify-center font-mono-tech font-bold text-sm bg-[#F26A21] text-white rounded-full">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-semibold text-white truncate" title={s.name}>{s.name || "Parada"}</div>
                          {s.pendiente && <span data-testid={`stop-pendiente-${index}`} className="shrink-0 text-[9px] font-bold uppercase bg-red-600 text-white rounded px-1.5 py-0.5">Pendiente ayer</span>}
                        </div>
                        {s.address && <div className="text-xs text-slate-400 truncate" title={s.address}>{s.address}</div>}
                        <div className="flex items-center gap-3 mt-1">
                          {!readOnlyMeta && (
                            <span className="text-[10px] font-mono-tech text-slate-400">
                              {Number(s.lat).toFixed(4)}, {Number(s.lon).toFixed(4)}
                            </span>
                          )}
                          {readOnlyMeta ? (
                            s.stop_type && (
                              <span data-testid={`stop-type-${index}`} className="ml-auto text-[10px] font-bold uppercase bg-slate-700/60 border border-slate-600 text-slate-200 rounded px-1.5 py-0.5">
                                {TYPE_LABELS[s.stop_type] || s.stop_type}
                              </span>
                            )
                          ) : (
                            <select
                              data-testid={`stop-type-${index}`}
                              value={s.stop_type || ""}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onChangeType(s.id, e.target.value)}
                              className="ml-auto text-[10px] bg-slate-900 border border-slate-700 text-slate-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#F26A21] cursor-pointer"
                            >
                              <option value="">Sin tipo</option>
                              <option value="P">Particular</option>
                              <option value="PD">PUDO</option>
                              <option value="L">Locker</option>
                              <option value="L24">Locker 24h</option>
                            </select>
                          )}
                          {s.service_min != null && (
                            <span data-testid={`stop-min-${index}`} className={`text-[10px] font-mono-tech text-[#F26A21] ${readOnlyMeta && s.stop_type ? "" : ""}`}>{s.service_min}m</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                          <Clock size={10} className="text-slate-500 shrink-0" />
                          {readOnlyMeta ? (
                            <span data-testid={`stop-window-${index}`} className="text-[10px] font-mono-tech text-slate-300">
                              {(s.window_from || "").slice(0, 5) || "--:--"} – {(s.window_to || "").slice(0, 5) || "--:--"}
                            </span>
                          ) : (
                            <>
                              <input
                                data-testid={`stop-wfrom-${index}`}
                                type="time"
                                value={(s.window_from || "").slice(0, 5)}
                                onChange={(e) => onChangeWindow(s.id, e.target.value, (s.window_to || "").slice(0, 5))}
                                className="text-[10px] font-mono-tech bg-slate-900 border border-slate-700 text-slate-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-[#F26A21] w-[96px]"
                              />
                              <span className="text-slate-500 text-[10px]">–</span>
                              <input
                                data-testid={`stop-wto-${index}`}
                                type="time"
                                value={(s.window_to || "").slice(0, 5)}
                                onChange={(e) => onChangeWindow(s.id, (s.window_from || "").slice(0, 5), e.target.value)}
                                className="text-[10px] font-mono-tech bg-slate-900 border border-slate-700 text-slate-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-[#F26A21] w-[96px]"
                              />
                            </>
                          )}
                          {sched && (
                            <span
                              data-testid={`stop-eta-${index}`}
                              className={`ml-auto text-[10px] font-mono-tech font-semibold ${late ? "text-red-400" : "text-emerald-400"}`}
                              title={late ? "Llega fuera de la ventana" : "Hora estimada de llegada"}
                            >
                              ETA {sched.arrival}{sched.wait_min > 0 ? ` · +${sched.wait_min}m` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      {!readOnlyMeta && (
                        <button
                          data-testid={`remove-stop-${index}`}
                          title="Eliminar"
                          onClick={(e) => { e.stopPropagation(); onRemove(s.id); }}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
