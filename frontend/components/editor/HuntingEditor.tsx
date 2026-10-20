"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { errMsg } from "@/lib/hooks";
import { Button, EmptyState, Field, Input, Select } from "../ui/basics";
import { useConfirm } from "../ui/overlay";
import { CodeEditor, CodeView } from "../Code";
import { SiemMark } from "../domain/marks";

export type Hunt = { id: number; siem: string; siem_nom?: string; titre: string; objectif: string; requete: string; periode_conseillee: string; rendu?: string };
type Draft = Omit<Hunt, "id">;

function Form({ initial, platforms, onSubmit, onCancel, label }: { initial: Draft; platforms: { siem: string; nom: string; mode: string }[]; onSubmit: (d: Draft) => Promise<void>; onCancel: () => void; label: string }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const mode = platforms.find((p) => p.siem === d.siem)?.mode ?? "text";
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-[220px_1fr_150px]">
        <Field label="Plateforme"><Select value={d.siem} onChange={(e) => setD({ ...d, siem: e.target.value })}>{platforms.map((p) => <option key={p.siem} value={p.siem}>{p.nom}</option>)}</Select></Field>
        <Field label="Titre"><Input autoFocus value={d.titre} onChange={(e) => setD({ ...d, titre: e.target.value })} placeholder="Ex. Échecs puis succès sur 7 jours" /></Field>
        <Field label="Période conseillée"><Input value={d.periode_conseillee} onChange={(e) => setD({ ...d, periode_conseillee: e.target.value })} placeholder="7 jours" /></Field>
      </div>
      <Field label="Objectif"><Input value={d.objectif} onChange={(e) => setD({ ...d, objectif: e.target.value })} placeholder="Ce que cette recherche permet de trouver" /></Field>
      <Field label="Requête" group><CodeEditor value={d.requete} onChange={(v) => setD({ ...d, requete: v })} mode={mode} minHeight="140px" /></Field>
      <div className="flex gap-2"><Button variant="primary" loading={busy} disabled={!d.titre.trim() || !d.requete.trim() || !d.siem} onClick={async () => { setBusy(true); try { await onSubmit(d); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } }}>{label}</Button><Button onClick={onCancel}>Annuler</Button></div>
    </div>
  );
}

export default function HuntingEditor({ items, platforms, editable, onCreate, onUpdate, onDelete }: {
  items: Hunt[]; platforms: { siem: string; nom: string; mode: string }[]; editable: boolean;
  onCreate: (d: Draft) => Promise<void>; onUpdate: (id: number, d: Draft) => Promise<void>; onDelete: (id: number) => Promise<void>;
}) {
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const blank: Draft = { siem: platforms[0]?.siem ?? "", titre: "", objectif: "", requete: "", periode_conseillee: "" };
  const hasRendu = items.some((h) => h.rendu !== undefined);
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-fg-3">Requêtes de recherche proactive (threat hunting), par plateforme.</p>
        <div className="flex gap-2">
          {hasRendu && <label className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-2"><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} className="accent-[var(--accent)]" />Aperçu avec les valeurs</label>}
          {editable && !adding && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)} disabled={!platforms.length}>Ajouter une requête</Button>}
        </div>
      </div>
      {adding && <div className="surface p-5"><Form initial={blank} platforms={platforms} label="Ajouter la requête" onCancel={() => setAdding(false)} onSubmit={async (d) => { await onCreate(d); setAdding(false); toast.success("Requête ajoutée."); }} /></div>}
      {!items.length && !adding && <EmptyState title="Aucune requête de hunting" action={editable ? <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Ajouter une requête</Button> : undefined}>Les requêtes de recherche proactive de cette détection apparaîtront ici.</EmptyState>}
      {items.map((h) => (
        <article key={h.id} className="surface p-5">
          {editing === h.id ? (
            <Form initial={h} platforms={platforms} label="Enregistrer" onCancel={() => setEditing(null)} onSubmit={async (d) => { await onUpdate(h.id, d); setEditing(null); toast.success("Requête enregistrée."); }} />
          ) : (
            <div className="grid gap-3">
              <header className="flex items-center gap-3">
                <SiemMark code={h.siem} nom={h.siem_nom ?? h.siem} size={28} />
                <div className="mr-auto min-w-0"><h3 className="truncate text-[16px] font-semibold">{h.titre}</h3><p className="text-[13px] text-fg-3">{h.siem_nom ?? h.siem}{h.periode_conseillee && `, période conseillée : ${h.periode_conseillee}`}</p></div>
                {editable && <><Button size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(h.id)}>Modifier</Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={async () => { if (await confirm({ title: "Supprimer cette requête ?", description: h.titre, confirmLabel: "Supprimer", danger: true })) { try { await onDelete(h.id); toast.success("Requête supprimée."); } catch (e) { toast.error(errMsg(e)); } } }}>Supprimer</Button></>}
              </header>
              {h.objectif && <p className="text-fg-2">{h.objectif}</p>}
              <CodeView code={preview && h.rendu !== undefined ? h.rendu : h.requete} label={h.titre} />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
