"use client";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { STAGES, type Lead, type Stage } from "@/lib/types";
import { ActorBadge, TierBadge } from "./ui";

export function Kanban({ leads, onMove, onOpen }: { leads: Lead[]; onMove: (leadId: string, stage: Stage) => void; onOpen: (l: Lead) => void }) {
  const onDragEnd = (r: DropResult) => { if (r.destination && r.destination.droppableId !== r.source.droppableId) onMove(r.draggableId, r.destination.droppableId as Stage); };
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-5 gap-3">
        {STAGES.map((stage) => {
          const col = leads.filter((l) => l.stage === stage);
          return (
            <Droppable droppableId={stage} key={stage}>
              {(p, snap) => (
                <div ref={p.innerRef} {...p.droppableProps} className={`min-h-[320px] rounded-lg border p-2 ${snap.isDraggingOver ? "border-neutral-900 bg-neutral-100" : "border-neutral-200 bg-neutral-50"}`}>
                  <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-600"><span>{stage}</span><span className="font-mono">{col.length}</span></div>
                  {col.map((l, i) => (
                    <Draggable draggableId={l.id} index={i} key={l.id}>
                      {(d) => (
                        <div ref={d.innerRef} {...d.draggableProps} {...d.dragHandleProps} onClick={() => onOpen(l)} className="mb-2 cursor-grab rounded-md border border-neutral-200 bg-white p-2 text-xs shadow-sm">
                          <div className="flex items-center justify-between gap-1"><span className="truncate text-[13px] font-medium">{l.company}</span><span className="flex shrink-0 items-center gap-1"><span className="font-mono">{l.score}</span><TierBadge tier={l.tier} /></span></div>
                          <div className="truncate text-neutral-500">{l.contact.name}, {l.contact.title}</div>
                          <div className="mt-1.5 flex items-center gap-1.5"><ActorBadge actor={l.lastActor} /><span className="truncate text-neutral-600">{l.lastAction}</span></div>
                          <div className="mt-1 font-mono text-[10px] text-neutral-400">cost {l.costCredits} cr{l.warmPath ? " · warm intro" : ""}</div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {p.placeholder}
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}
