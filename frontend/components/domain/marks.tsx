"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { GRAVITE_LEVEL, STATUTS, STATUT_LABEL, graviteColor, statutColor, type StatutId } from "@/lib/status";
import { hue } from "@/lib/format";
import { Tip } from "../ui/overlay";

export function StatusPill({ statut, className, size = "md" }: { statut: string; className?: string; size?: "sm" | "md" }) {
  const c = statutColor(statut);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border font-medium", size === "sm" ? "px-2 py-px text-xs" : "px-2.5 py-0.5 text-[13px]", className)}
      style={{ color: c, borderColor: `color-mix(in srgb, ${c} 38%, transparent)`, background: `color-mix(in srgb, ${c} 11%, transparent)` }}>
      <span className="size-1.5 rounded-full" style={{ background: c }} />{STATUT_LABEL[statut] ?? statut}
    </span>
  );
}

/** Gravité : quatre barres, comme un indicateur de signal. La couleur et le nombre de barres portent l'information. */
export function SeverityBars({ gravite, showLabel, className }: { gravite: string; showLabel?: boolean; className?: string }) {
  const level = GRAVITE_LEVEL[gravite] ?? 0, c = graviteColor(gravite);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`Gravité ${gravite}`}>
      <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden>
        {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 4} y={11 - i * 3.4} width="3" height={3 + i * 3.4} rx="1" fill={i < level ? c : "var(--line)"} />)}
      </svg>
      {showLabel && <span className="text-[13px]" style={{ color: c }}>{gravite}</span>}
    </span>
  );
}

/** Journalisation : voyant vert « OK » ou creux « Non ». */
export function JournalLed({ value, label = false, className }: { value: "ok" | "non" | string; label?: boolean; className?: string }) {
  const ok = value === "ok";
  return (
    <Tip label={ok ? "Journalisation OK : les logs nécessaires arrivent dans le SIEM" : "Journalisation non : des logs restent à ajouter"}>
      <span className={cn("inline-flex items-center gap-1.5 text-xs", ok ? "text-ok" : "text-fg-3", className)}>
        <span className={cn("grid size-4 place-items-center rounded-full border", ok ? "border-ok bg-ok/15" : "border-dashed border-fg-3/50")}>
          {ok ? <Check className="size-2.5" strokeWidth={4} /> : <span className="size-1 rounded-full bg-fg-3/50" />}
        </span>
        {label && (ok ? "Journalisation OK" : "Journalisation non")}
      </span>
    </Tip>
  );
}

/** Bande d'avancement : une graduation par détection, colorée par statut. Élément signature de la plateforme. */
export function ReadinessStrip({ items, height = 10, onPick, className }: {
  items: { statut: StatutId | string; code?: string; id?: number }[]; height?: number; onPick?: (i: { id?: number; code?: string }) => void; className?: string;
}) {
  if (!items.length) return <div className={cn("rounded-full bg-panel-2", className)} style={{ height }} />;
  return (
    <div className={cn("flex w-full items-stretch gap-[2px]", className)} style={{ height }} role="img" aria-label={`${items.length} détections par statut`}>
      {items.map((it, i) => (
        <span key={it.id ?? i} title={it.code ? `${it.code} · ${STATUT_LABEL[it.statut] ?? it.statut}` : STATUT_LABEL[it.statut]}
          onClick={onPick ? () => onPick(it) : undefined}
          className={cn("tick min-w-[2px] flex-1 origin-bottom rounded-[2px]", onPick && "cursor-pointer")}
          style={{ background: statutColor(it.statut), opacity: it.statut === "brouillon" ? 0.55 : 1 }} />
      ))}
    </div>
  );
}

/** Répartition par statut sous forme de barre continue (domaines, cartes client). */
export function StatusBar({ counts, height = 6, className }: { counts: Record<string, number>; height?: number; className?: string }) {
  const total = STATUTS.reduce((a, s) => a + (counts[s.id] ?? 0), 0);
  return (
    <div className={cn("flex w-full overflow-hidden rounded-full bg-panel-2", className)} style={{ height }} role="img" aria-label="Répartition par statut">
      {STATUTS.map((s) => counts[s.id] ? <span key={s.id} title={`${s.label} : ${counts[s.id]}`} style={{ width: `${(counts[s.id] / Math.max(total, 1)) * 100}%`, background: statutColor(s.id), opacity: s.id === "brouillon" ? 0.55 : 1 }} /> : null)}
    </div>
  );
}

/** Les cinq étapes du cycle de vie : cliquer sur une étape change le statut. */
export function PipelineMeter({ statut, onChange, disabled }: { statut: StatutId; onChange?: (s: StatutId) => void; disabled?: boolean }) {
  const idx = STATUTS.findIndex((s) => s.id === statut);
  return (
    <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Statut de la détection">
      {STATUTS.map((s, i) => {
        const reached = i <= idx, current = i === idx, c = statutColor(statut);
        return (
          <Tip key={s.id} label={<><b>{s.label}</b><br />{s.desc}</>}>
            <button type="button" role="radio" aria-checked={current} disabled={disabled || !onChange} onClick={() => onChange?.(s.id)}
              className="group grid gap-1.5 text-left disabled:cursor-default">
              <span className="h-2 rounded-full transition-all" style={{ background: reached ? (i === idx ? c : `color-mix(in srgb, ${c} 55%, transparent)`) : "var(--panel-3)", boxShadow: current ? `0 0 0 3px color-mix(in srgb, ${c} 25%, transparent)` : undefined }} />
              <span className={cn("truncate text-[11.5px] leading-none transition-colors", current ? "font-semibold text-fg" : "text-fg-3 group-hover:text-fg-2")}>{s.label}</span>
            </button>
          </Tip>
        );
      })}
    </div>
  );
}

export function ClientMark({ nom, size = 32, className }: { nom: string; size?: number; className?: string }) {
  const h = hue(nom);
  return (
    <span className={cn("inline-grid shrink-0 place-items-center rounded-[9px] font-bold", className)} aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(145deg, hsl(${h} 70% 56%), hsl(${(h + 40) % 360} 65% 38%))`, color: "white", textShadow: "0 1px 2px rgb(0 0 0 / .35)" }}>
      {nom.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Pastille d'une plateforme SIEM / XDR : monogramme coloré. `present` = une règle existe. */
export function SiemMark({ code, nom, present = true, size = 22 }: { code: string; nom: string; present?: boolean; size?: number }) {
  const h = hue(code);
  const text = nom.replace(/[()]/g, "").split(/[\s/.-]+/).filter((w) => /^[A-Za-z0-9]/.test(w)).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <Tip label={`${nom} : ${present ? "règle présente" : "pas de règle"}`}>
      <span className="inline-grid shrink-0 place-items-center rounded-md font-semibold" style={{
        width: size, height: size, fontSize: size * 0.42,
        background: present ? `hsl(${h} 50% 30%)` : "transparent", color: present ? `hsl(${h} 90% 86%)` : "var(--fg-3)",
        border: present ? `1px solid hsl(${h} 50% 42%)` : "1px dashed var(--line)",
      }}>{text}</span>
    </Tip>
  );
}
