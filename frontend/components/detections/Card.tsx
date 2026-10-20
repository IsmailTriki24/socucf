"use client";
import { useDraggable } from "@dnd-kit/core";
import { Check, GripVertical, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { STATUTS, statutColor } from "@/lib/status";
import type { DetectionItem, SiemLite } from "@/lib/types";
import { JournalLed, SeverityBars, SiemMark, StatusPill } from "../domain/marks";
import { Menu } from "../ui/overlay";

type Props = {
  item: DetectionItem; siems: SiemLite[]; selected: boolean; anySelected: boolean; canEdit: boolean;
  onOpen: () => void; onSelect: () => void; onStatut: (s: string) => void; onJournal: (v: "ok" | "non") => void; onDelete: () => void;
  variant?: "compact" | "rich"; dragging?: boolean;
};

function Platforms({ item, siems, max = 5 }: { item: DetectionItem; siems: SiemLite[]; max?: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {siems.slice(0, max).map((s) => <SiemMark key={s.code} code={s.code} nom={s.nom} present={item.siems_regle.includes(s.code)} size={20} />)}
      {siems.length > max && <span className="text-xs text-fg-3">+{siems.length - max}</span>}
    </span>
  );
}

export function CardBody({ item, siems, selected, anySelected, canEdit, onOpen, onSelect, onStatut, onJournal, onDelete, variant = "compact", dragging, handle }: Props & { handle?: React.ReactNode }) {
  const c = statutColor(item.statut);
  const rich = variant === "rich";
  return (
    <div className={cn("group/card relative min-w-0 rounded-lg border bg-panel transition-colors", selected ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50", dragging && "opacity-40")}>
      <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full" style={{ background: c, opacity: item.statut === "brouillon" ? 0.5 : 1 }} aria-hidden />
      <div className="grid min-w-0 gap-2 px-3.5 py-3 pl-4">
        <div className="flex items-center gap-2">
          {handle}
          <button type="button" onClick={onOpen} className="mono text-[12.5px] font-medium text-fg-2 hover:text-accent">{item.code}</button>
          <SeverityBars gravite={item.gravite} />
          <span className="ml-auto flex items-center gap-1.5">
            <JournalLed value={item.journalisation} />
            {canEdit && (
              <>
                <button type="button" role="checkbox" aria-checked={selected} aria-label={`Sélectionner ${item.code}`} onClick={onSelect}
                  className={cn("grid size-[18px] place-items-center rounded-[5px] border transition-opacity", selected ? "border-accent bg-accent text-accent-ink opacity-100" : "border-line opacity-0 focus-visible:opacity-100 group-hover/card:opacity-100", anySelected && !selected && "opacity-100")}>
                  {selected && <Check className="size-3" strokeWidth={4} />}
                </button>
                <Menu label={`Actions pour ${item.code}`} trigger={<button type="button" aria-label={`Actions pour ${item.code}`} className="grid size-6 place-items-center rounded text-fg-3 opacity-0 hover:bg-panel-3 hover:text-fg focus-visible:opacity-100 group-hover/card:opacity-100"><MoreHorizontal className="size-4" /></button>}
                  items={[
                    ...STATUTS.filter((s) => s.id !== item.statut).map((s) => ({ label: `Passer en ${s.label.toLowerCase()}`, icon: <span className="size-2.5 rounded-full" style={{ background: statutColor(s.id) }} />, onSelect: () => onStatut(s.id) })),
                    "separator" as const,
                    { label: item.journalisation === "ok" ? "Journalisation : Non" : "Journalisation : OK", onSelect: () => onJournal(item.journalisation === "ok" ? "non" : "ok") },
                    "separator" as const,
                    { label: "Supprimer du client", danger: true, onSelect: onDelete },
                  ]} />
              </>
            )}
          </span>
        </div>
        <button type="button" onClick={onOpen} className={cn("text-left font-medium leading-snug hover:text-accent", rich ? "text-[15px]" : "line-clamp-2 text-[14px]")}>{item.cas_usage}</button>
        {rich && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-3">
            <StatusPill statut={item.statut} size="sm" />
            {item.techniques.slice(0, 3).map((t) => <span key={t} className="mono text-xs">{t}</span>)}
            {item.techniques.length > 3 && <span className="text-xs">+{item.techniques.length - 3}</span>}
            <span>{item.type_detection}</span>
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-fg-3">{item.domaine}</span>
          <Platforms item={item} siems={siems} />
        </div>
      </div>
    </div>
  );
}

function ActiveDraggable(props: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(props.item.id) });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className="min-w-0 cursor-grab touch-none outline-none active:cursor-grabbing">
      <CardBody {...props} dragging={isDragging} handle={<GripVertical className="-ml-1.5 size-3.5 shrink-0 text-fg-3/50" />} />
    </div>
  );
}

/** Un lecteur n'a pas de glisser-déposer : sans wrapper, sinon la carte serait annoncée « désactivée » alors qu'on peut l'ouvrir. */
export function DraggableCard(props: Props) {
  return props.canEdit ? <ActiveDraggable {...props} /> : <div className="min-w-0"><CardBody {...props} /></div>;
}
