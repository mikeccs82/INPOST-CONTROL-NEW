import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Home, Flag, Clock } from "lucide-react";

export const StopList = ({ stops, onReorder, onRemove, onSetDepot }) => {
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
              const isDepot = index === 0;
              return (
                <Draggable key={s.id} draggableId={s.id} index={index}>
                  {(prov, snapshot) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      data-testid={`stop-item-${index}`}
                      className={`bg-slate-800 border rounded-md p-3 mb-2 flex items-center gap-3 transition-colors ${
                        snapshot.isDragging ? "border-[#FF6B00] shadow-lg" : "border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      <span {...prov.dragHandleProps} className="text-slate-500 hover:text-white cursor-grab active:cursor-grabbing">
                        <GripVertical size={18} />
                      </span>
                      <div
                        className={`shrink-0 w-8 h-8 flex items-center justify-center font-mono-tech font-bold text-sm ${
                          isDepot ? "bg-emerald-500 text-emerald-950 rounded-md" : "bg-[#FF6B00] text-black rounded-full"
                        }`}
                      >
                        {isDepot ? <Home size={16} /> : index}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate" title={s.name}>{s.name || "Parada"}</div>
                        {s.address && <div className="text-xs text-slate-400 truncate" title={s.address}>{s.address}</div>}
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] font-mono-tech text-slate-400">
                            {Number(s.lat).toFixed(4)}, {Number(s.lon).toFixed(4)}
                          </span>
                          {(s.window_from || s.window_to) && (
                            <span className="text-[10px] font-mono-tech text-slate-400 flex items-center gap-1">
                              <Clock size={10} />
                              {(s.window_from || "").slice(0, 5)}–{(s.window_to || "").slice(0, 5)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!isDepot && (
                          <button
                            data-testid={`set-depot-${index}`}
                            title="Fijar como depósito"
                            onClick={() => onSetDepot(index)}
                            className="text-slate-500 hover:text-emerald-400 transition-colors"
                          >
                            <Home size={15} />
                          </button>
                        )}
                        <button
                          data-testid={`remove-stop-${index}`}
                          title="Eliminar"
                          onClick={() => onRemove(s.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
