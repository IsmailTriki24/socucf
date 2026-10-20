"use client";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Eye, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "sonner";
import { errMsg } from "@/lib/hooks";
import { Button, Chip, EmptyState, Input, Notice, Select, Textarea } from "../ui/basics";
import { useConfirm } from "../ui/overlay";
import { CodeEditor, CodeView, CopyButton } from "../Code";
import { SiemMark } from "../domain/marks";

export type Platform = {
  siem: string; nom: string; mode: string; langage?: string; presente: boolean; contenu: string; champs_requis: string[]; notes: string; rendu?: string; nonResolus?: string[];
};
export type Guide = { notion: string; siem: string; texte: string }[];

function RuleBody({ p, editable, platforms, guide, onSave, onDelete }: {
  p: Platform; editable: boolean; platforms: Platform[]; guide: Guide; onSave: (siem: string, v: { contenu: string; champs_requis: string[]; notes: string }) => Promise<void>; onDelete: (siem: string) => Promise<void>;
}) {
  const confirm = useConfirm();
  const [text, setText] = useState(p.contenu);
  const [champs, setChamps] = useState<string[]>(p.champs_requis);
  const [notes, setNotes] = useState(p.notes);
  const [chip, setChip] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("");
  const dirty = text !== p.contenu || notes !== p.notes || champs.join("|") !== p.champs_requis.join("|");
  const sources = platforms.filter((x) => x.presente && x.siem !== p.siem);
  const g = guide.filter((x) => x.siem === p.siem);

  async function save() {
    if (!text.trim()) return toast.error("La règle est vide.");
    setBusy(true);
    try { await onSave(p.siem, { contenu: text, champs_requis: champs, notes }); toast.success(`Règle ${p.nom} enregistrée.`); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!(await confirm({ title: `Supprimer la règle ${p.nom} ?`, description: "Le texte de la règle est effacé pour cette détection.", confirmLabel: "Supprimer", danger: true }))) return;
    try { await onDelete(p.siem); toast.success("Règle supprimée."); } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto"><h3 className="text-[17px] font-semibold">{p.nom}</h3>{p.langage && <p className="text-[13px] text-fg-3">{p.langage}</p>}</div>
        {p.presente && p.rendu !== undefined && <Button size="sm" variant={preview ? "primary" : "secondary"} icon={<Eye className="size-3.5" />} onClick={() => setPreview(!preview)}>Aperçu avec les valeurs</Button>}
        {editable && sources.length > 0 && !p.presente && !text && (
          <Select className="h-8 w-52 text-[13px]" value={from} aria-label="Partir d'une autre plateforme" onChange={(e) => { const s = sources.find((x) => x.siem === e.target.value); setFrom(e.target.value); if (s) setText(s.contenu); }}>
            <option value="">Partir de la règle de…</option>{sources.map((s) => <option key={s.siem} value={s.siem}>{s.nom}</option>)}
          </Select>
        )}
        <CopyButton text={preview ? p.rendu ?? text : text} />
        {editable && p.presente && <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={remove}>Supprimer</Button>}
      </div>
      {!!p.nonResolus?.length && <Notice kind="warn">Paramètres sans valeur : {p.nonResolus.map((n) => <span key={n} className="mono mr-1.5 rounded bg-warn/20 px-1">{`{{${n}}}`}</span>)} Renseignez-les dans l&apos;onglet Fiche.</Notice>}
      {preview ? <CodeView code={p.rendu ?? ""} label="Règle avec les valeurs du client" /> : editable ? <CodeEditor value={text} onChange={setText} mode={p.mode} minHeight="240px" /> : <CodeView code={p.contenu} label={`Règle ${p.nom}`} />}
      {!p.presente && !editable && <EmptyState title="Pas de règle pour cette plateforme">Personne n&apos;a encore écrit la règle {p.nom}.</EmptyState>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <span className="text-[13px] font-medium text-fg-2">Champs requis (à vérifier dans la normalisation du client)</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {champs.map((c) => <Chip key={c} onRemove={editable ? () => setChamps(champs.filter((x) => x !== c)) : undefined} className="mono">{c}</Chip>)}
            {editable && <form onSubmit={(e) => { e.preventDefault(); const v = chip.trim(); if (v && !champs.includes(v)) setChamps([...champs, v]); setChip(""); }}><Input className="mono h-7 w-44 text-xs" placeholder="+ champ puis Entrée" value={chip} onChange={(e) => setChip(e.target.value)} aria-label="Ajouter un champ requis" /></form>}
            {!champs.length && !editable && <span className="text-[13px] text-fg-3">Aucun</span>}
          </div>
        </div>
        <label className="grid content-start gap-1.5"><span className="text-[13px] font-medium text-fg-2">Prérequis et notes</span><Textarea disabled={!editable} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div>
      {editable && <div className="flex items-center gap-3"><Button variant="primary" loading={busy} disabled={!dirty || !text.trim()} onClick={save}>{p.presente ? "Enregistrer la règle" : "Créer la règle"}</Button>{dirty && <span className="text-[13px] text-warn">Non enregistrée</span>}</div>}
      <p className="text-xs text-fg-3">À valider sur un environnement de test avant déploiement. Rejouez un événement simulé, jamais l&apos;attaque réelle.</p>
      {g.length > 0 && (
        <details className="surface-2 group px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] font-medium"><BookOpen className="size-4 text-fg-3" />Guide de traduction pour {p.nom}<span className="ml-auto text-xs text-fg-3 group-open:hidden">{g.length} notions</span></summary>
          <dl className="mt-3 grid gap-3">{g.map((x) => <div key={x.notion}><dt className="text-[13px] font-semibold">{x.notion}</dt><dd className="text-[13px] leading-relaxed text-fg-2">{x.texte}</dd></div>)}</dl>
        </details>
      )}
    </div>
  );
}

export default function RulesEditor({ platforms, editable, guide, onSave, onDelete }: {
  platforms: Platform[]; editable: boolean; guide: Guide; onSave: (siem: string, v: { contenu: string; champs_requis: string[]; notes: string }) => Promise<void>; onDelete: (siem: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const ordered = useMemo(() => [...platforms].sort((a, b) => Number(b.presente) - Number(a.presente)), [platforms]);
  const [sel, setSel] = useState(ordered[0]?.siem ?? "");
  useEffect(() => { if (!platforms.some((p) => p.siem === sel)) setSel(ordered[0]?.siem ?? ""); }, [platforms]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = ordered.filter((p) => !q || p.nom.toLowerCase().includes(q.toLowerCase()));
  const cur = platforms.find((p) => p.siem === sel);
  if (!platforms.length) return <EmptyState title="Aucune plateforme">Ajoutez au moins une plateforme SIEM / XDR dans les paramètres du client.</EmptyState>;
  const nb = platforms.filter((p) => p.presente).length;
  return (
    <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
      <aside className="grid content-start gap-2">
        <p className="px-1 text-[13px] text-fg-3">{nb} règle{nb > 1 ? "s" : ""} sur {platforms.length} plateforme{platforms.length > 1 ? "s" : ""}</p>
        {platforms.length > 7 && <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-fg-3" /><Input className="pl-9" placeholder="Filtrer…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrer les plateformes" />{q && <button className="absolute right-2 top-2 text-fg-3" aria-label="Effacer" onClick={() => setQ("")}><X className="size-4" /></button>}</div>}
        <div className="scroll-thin grid max-h-[560px] gap-1 overflow-y-auto" role="tablist" aria-label="Plateformes" aria-orientation="vertical">
          {shown.map((p) => (
            <button key={p.siem} role="tab" aria-selected={p.siem === sel} onClick={() => setSel(p.siem)}
              className={cn("flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors", p.siem === sel ? "border-accent/60 bg-accent-soft" : "border-transparent hover:bg-panel-2")}>
              <SiemMark code={p.siem} nom={p.nom} present={p.presente} size={26} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{p.nom}</span><span className={cn("block text-xs", p.presente ? "text-ok" : "text-fg-3")}>{p.presente ? "Règle écrite" : editable ? "À écrire" : "Pas de règle"}</span></span>
              {!p.presente && editable && <Plus className="size-3.5 text-fg-3" />}
            </button>
          ))}
          {!shown.length && <p className="px-2 py-3 text-[13px] text-fg-3">Aucune plateforme.</p>}
        </div>
      </aside>
      <div className="surface min-w-0 p-5">{cur && <RuleBody key={`${cur.siem}:${cur.presente}:${cur.contenu.length}`} p={cur} editable={editable} platforms={platforms} guide={guide} onSave={onSave} onDelete={onDelete} />}</div>
    </div>
  );
}
