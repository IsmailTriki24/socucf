"use client";
import { useState } from "react";
import { Check, ChevronDown, Link2, Plus, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { errMsg } from "@/lib/hooks";
import type { SourceEntry, SourceLog } from "@/lib/types";
import { Button, EmptyState, Input, Notice, Segmented, Switch } from "../ui/basics";
import { Pop } from "../ui/overlay";
import { JournalLed } from "../domain/marks";

/** Sources de logs requises par une détection. Côté client : voyant de journalisation et bouton « Ajouter » par source. */
export default function SourcesPanel({ sources, allSources, editable, client, onSourcesChange, onJournal, onAjouter }: {
  sources: SourceEntry[]; allSources: SourceLog[]; editable: boolean;
  client?: { journalisation: "ok" | "non" };
  onSourcesChange: (rows: { source_id: number; obligatoire: boolean }[]) => Promise<void>;
  onJournal?: (v: "ok" | "non") => Promise<void>;
  onAjouter?: (sourceId: number, retirer: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const rows = sources.map((s) => ({ source_id: s.source_id, obligatoire: s.obligatoire }));
  const missing = sources.filter((s) => !s.collectee);
  const candidates = allSources.filter((s) => !sources.some((x) => x.source_id === s.id) && (!q || s.nom.toLowerCase().includes(q.toLowerCase())));
  const run = async (fn: () => Promise<void>, id: number | null = null) => { setBusy(id); try { await fn(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); } };

  return (
    <div className="grid gap-5">
      {client && (
        <section className="surface flex flex-wrap items-center gap-5 p-5">
          <div className="min-w-60 flex-1">
            <h3 className="flex items-center gap-2 text-[16px] font-semibold">Journalisation de cette détection <JournalLed value={client.journalisation} label /></h3>
            <p className="mt-1 text-[13.5px] text-fg-3">« OK » signifie que les logs nécessaires arrivent déjà dans le SIEM du client. Elle passe à OK toute seule quand les sources requises sont ajoutées, ou vous pouvez la régler à la main.</p>
          </div>
          <Segmented size="md" label="Journalisation" value={client.journalisation} onChange={(v) => editable && onJournal && run(() => onJournal(v))}
            options={[{ value: "ok", label: "OK", color: "var(--ok)" }, { value: "non", label: "Non", color: "var(--err)" }]} />
        </section>
      )}

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-semibold">Sources de logs requises</h3>
          {editable && (
            <Pop width={340} align="end" trigger={<Button icon={<Link2 className="size-4" />}>Associer une source</Button>}>
              {(close) => (
                <div className="grid gap-1.5">
                  <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une source…" aria-label="Chercher une source" />
                  <div className="scroll-thin max-h-72 overflow-y-auto">
                    {candidates.map((s) => <button key={s.id} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] hover:bg-panel-2" onClick={() => { close(); run(() => onSourcesChange([...rows, { source_id: s.id, obligatoire: false }])); }}><Plus className="size-3.5 text-fg-3" />{s.nom}</button>)}
                    {!candidates.length && <p className="px-2 py-3 text-center text-[13px] text-fg-3">Aucune autre source.</p>}
                  </div>
                </div>
              )}
            </Pop>
          )}
        </div>
        {client && missing.length > 0 && <Notice kind="warn">{missing.length} source{missing.length > 1 ? "s" : ""} à ajouter chez le client pour que cette détection ait des logs à analyser.</Notice>}
        {sources.length === 0 && <EmptyState title="Aucune source associée">Associez les sources de logs dont cette détection a besoin.</EmptyState>}
        <ul className="grid gap-2">
          {sources.map((s) => {
            const isOpen = open === s.source_id;
            return (
              <li key={s.source_id} className={cn("surface overflow-hidden", client && !s.collectee && "border-warn/40")}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => setOpen(isOpen ? null : s.source_id)} aria-expanded={isOpen}>
                    <ChevronDown className={cn("size-4 shrink-0 text-fg-3 transition-transform", isOpen && "rotate-180")} />
                    <span className="truncate font-medium">{s.nom}</span>
                  </button>
                  {client && (s.collectee
                    ? <span className="inline-flex items-center gap-1.5 text-[13px] text-ok"><Check className="size-4" strokeWidth={3} />Ajoutée</span>
                    : <span className="text-[13px] text-warn">À ajouter</span>)}
                  <label className="flex items-center gap-2 text-[13px] text-fg-2">
                    <Switch label={`${s.nom} obligatoire`} checked={s.obligatoire} disabled={!editable} onChange={(v) => run(() => onSourcesChange(rows.map((r) => (r.source_id === s.source_id ? { ...r, obligatoire: v } : r))))} />obligatoire
                  </label>
                  {client && editable && onAjouter && (s.collectee
                    ? <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} loading={busy === s.source_id} onClick={() => run(() => onAjouter(s.source_id, true), s.source_id)}>Retirer</Button>
                    : <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} loading={busy === s.source_id} onClick={() => run(() => onAjouter(s.source_id, false), s.source_id)}>Ajouter</Button>)}
                  {editable && <button type="button" aria-label={`Dissocier ${s.nom}`} className="text-fg-3 hover:text-err" onClick={() => run(() => onSourcesChange(rows.filter((r) => r.source_id !== s.source_id)))}><X className="size-4" /></button>}
                </div>
                {isOpen && (
                  <dl className="grid gap-3 border-t border-line-soft bg-bg-2/50 px-4 py-4 text-[13.5px] leading-relaxed md:grid-cols-3">
                    <div><dt className="mb-1 font-semibold">À activer</dt><dd className="text-fg-2">{s.a_activer || "Non renseigné."}</dd></div>
                    <div><dt className="mb-1 font-semibold">Événements ou champs clés</dt><dd className="mono text-[12.5px] text-fg-2">{s.evenements_cles || "Non renseigné."}</dd></div>
                    <div><dt className="mb-1 font-semibold">Piège fréquent</dt><dd className="text-fg-2">{s.piege || "Non renseigné."}</dd></div>
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
