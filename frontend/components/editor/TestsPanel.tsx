"use client";
import { useState } from "react";
import { CheckCircle2, Download, Paperclip, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { errMsg } from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
import type { Preuve } from "@/lib/types";
import { Avatar, Button, EmptyState, Field, Segmented, Textarea } from "../ui/basics";
import { useConfirm } from "../ui/overlay";

export default function TestsPanel({ preuves, editable, onAdd, onDelete }: { preuves: Preuve[]; editable: boolean; onAdd: (f: FormData) => Promise<void>; onDelete: (id: number) => Promise<void> }) {
  const confirm = useConfirm();
  const [resultat, setResultat] = useState<"reussi" | "echoue">("reussi");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const f = new FormData(); f.append("resultat", resultat); f.append("description", description); if (file) f.append("capture", file);
      await onAdd(f); setDescription(""); setFile(null); toast.success("Test enregistré.");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <section className="grid content-start gap-3">
        <p className="text-fg-3">Historique des tests : événement simulé ou ligne de log rejouée, résultat et capture.</p>
        {preuves.length === 0 && <EmptyState title="Aucun test enregistré">Ajoutez ici chaque test de la règle. Ce n&apos;est pas obligatoire pour changer de statut.</EmptyState>}
        <ol className="grid gap-2.5">
          {preuves.map((p) => (
            <li key={p.id} className="surface flex gap-3.5 p-4">
              {p.resultat === "reussi" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-err" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><b>{p.resultat === "reussi" ? "Alerte déclenchée" : "Échec du test"}</b><span className="text-[13px] text-fg-3">{fmtDate(p.date, true)}</span>
                  {p.auteur && <span className="flex items-center gap-1.5 text-[13px] text-fg-3"><Avatar name={p.auteur} size={18} />{p.auteur}</span>}</div>
                {p.description && <p className="mt-1.5 whitespace-pre-wrap text-fg-2">{p.description}</p>}
                {p.capture && <a href={`/api/preuves/${p.id}/capture`} className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline"><Download className="size-3.5" />Télécharger la capture</a>}
              </div>
              {editable && <button type="button" aria-label="Supprimer ce test" className="self-start text-fg-3 hover:text-err" onClick={async () => { if (await confirm({ title: "Supprimer ce test ?", confirmLabel: "Supprimer", danger: true })) { try { await onDelete(p.id); } catch (e) { toast.error(errMsg(e)); } } }}><Trash2 className="size-4" /></button>}
            </li>
          ))}
        </ol>
      </section>
      {editable && (
        <section className="surface grid content-start gap-4 p-5" aria-labelledby="h-add-test">
          <h3 id="h-add-test" className="text-[16px] font-semibold">Ajouter un test</h3>
          <Field label="Résultat" group><Segmented value={resultat} onChange={setResultat} options={[{ value: "reussi", label: "L'alerte s'est déclenchée", color: "var(--ok)" }, { value: "echoue", label: "Échec", color: "var(--err)" }]} /></Field>
          <Field label="Événement rejoué ou observation" hint="Rejouez un événement simulé, jamais l'attaque réelle."><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Capture (png, jpg, pdf, txt, log, json ; 5 Mo)"><label className="field flex cursor-pointer items-center gap-2 text-fg-2"><Paperclip className="size-4" /><span className="truncate">{file ? file.name : "Choisir un fichier"}</span><input type="file" hidden accept=".png,.jpg,.jpeg,.gif,.pdf,.txt,.log,.json,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></Field>
          <Button variant="primary" loading={busy} onClick={add}>Enregistrer le test</Button>
        </section>
      )}
    </div>
  );
}
