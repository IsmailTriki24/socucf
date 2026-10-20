"use client";
import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Pop } from "../ui/overlay";

export type Opt = { value: string; label: string; count?: number; color?: string };

/** Filtre à choix multiples : un bouton qui s'ouvre sur une liste cochable avec les effectifs. */
export function MultiFilter({ label, options, value, onChange, searchable }: { label: string; options: Opt[]; value: string[]; onChange: (v: string[]) => void; searchable?: boolean }) {
  const on = value.length > 0;
  const shown = on && value.length <= 2 ? value.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ") : on ? `${value.length} choisis` : "";
  return (
    <Pop width={260} trigger={
      <button type="button" className={cn("inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[13.5px] transition-colors", on ? "border-accent/60 bg-accent-soft text-fg" : "border-line bg-panel/60 text-fg-2 hover:border-accent/40")}>
        <span>{label}</span>{shown && <span className="max-w-32 truncate font-medium text-accent">{shown}</span>}<ChevronDown className="size-3.5 text-fg-3" />
      </button>}>
      <FilterList options={options} value={value} onChange={onChange} searchable={searchable} />
    </Pop>
  );
}

function FilterList({ options, value, onChange, searchable }: { options: Opt[]; value: string[]; onChange: (v: string[]) => void; searchable?: boolean }) {
  const [q, setQ] = useState("");
  const list = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid gap-1">
      {searchable && <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer…" className="field mb-1 h-8" aria-label="Filtrer la liste" />}
      <div className="scroll-thin max-h-72 overflow-y-auto">
        {list.map((o) => {
          const sel = value.includes(o.value);
          return (
            <button key={o.value} type="button" role="checkbox" aria-checked={sel} onClick={() => onChange(sel ? value.filter((x) => x !== o.value) : [...value, o.value])}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-panel-2">
              <span className={cn("grid size-4 shrink-0 place-items-center rounded-[5px] border", sel ? "border-accent bg-accent text-accent-ink" : "border-line")}>{sel && <Check className="size-3" strokeWidth={4} />}</span>
              {o.color && <span className="size-2.5 shrink-0 rounded-full" style={{ background: o.color }} />}
              <span className="min-w-0 flex-1 truncate text-[13.5px]">{o.label}</span>
              {o.count !== undefined && <span className="mono text-xs text-fg-3">{o.count}</span>}
            </button>
          );
        })}
        {!list.length && <p className="px-2 py-3 text-center text-[13px] text-fg-3">Aucun choix.</p>}
      </div>
      {value.length > 0 && <button type="button" onClick={() => onChange([])} className="mt-1 flex items-center justify-center gap-1.5 rounded-md border-t border-line-soft px-2 pt-2 text-[13px] text-fg-3 hover:text-fg"><X className="size-3.5" />Tout décocher</button>}
    </div>
  );
}
