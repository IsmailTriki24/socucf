"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, get, patch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { errMsg, useAsync } from "@/lib/hooks";
import { plural } from "@/lib/format";
import type { Domaine, Siem } from "@/lib/types";
import { Button, Field, Input, Loading, Notice, PageHeader, Switch } from "@/components/ui/basics";
import { useConfirm } from "@/components/ui/overlay";
import { DomainPicker, PlatformPicker } from "@/components/Pickers";
import { useClient } from "../ClientProvider";

export default function Parametres({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { client, can, reload } = useClient();
  const { me } = useAuth();
  const ws = useWorkspace();
  const router = useRouter();
  const confirm = useConfirm();
  const editable = can("client.edit");
  const siems = useAsync(() => get<Siem[]>("/siems"), []);
  const domaines = useAsync(() => get<Domaine[]>("/domaines"), []);
  const [f, setF] = useState({ nom: client.nom, secteur: client.secteur, actif: client.actif });
  const [sel, setSel] = useState(client.siems.map((s) => s.code));
  const [dom, setDom] = useState(client.domaines.map((d) => d.id));
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setF({ nom: client.nom, secteur: client.secteur, actif: client.actif }); setSel(client.siems.map((s) => s.code)); setDom(client.domaines.map((d) => d.id)); }, [client]);

  const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x) => b.includes(x));
  const siemsDirty = !same(sel, client.siems.map((s) => s.code)), domDirty = !same(dom, client.domaines.map((d) => d.id));
  const identDirty = f.nom !== client.nom || f.secteur !== client.secteur || f.actif !== client.actif;
  const nouveauxDomaines = (domaines.data ?? []).filter((d) => dom.includes(d.id) && !client.domaines.some((x) => x.id === d.id));
  const nbNouvelles = nouveauxDomaines.reduce((a, d) => a + (d.nb_templates ?? 0), 0);

  async function save(what: string, body: Record<string, unknown>) {
    setBusy(what);
    try {
      const r = await patch<{ detections_creees?: number; regles_ajoutees?: number }>(`/clients/${id}`, body);
      await reload();
      const bits = [r.detections_creees ? `${plural(r.detections_creees, "détection")} ajoutée(s)` : "", r.regles_ajoutees ? `${plural(r.regles_ajoutees, "règle")} copiée(s) depuis les templates` : ""].filter(Boolean);
      toast.success(`Enregistré${bits.length ? " : " + bits.join(", ") : ""}.`);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader title="Paramètres du client" subtitle={`Identité, plateformes et domaines de ${client.nom}. Tout reste modifiable à tout moment.`} />
      {!editable && <Notice kind="info" className="mb-5">Lecture seule : seuls les Admin client peuvent modifier ces paramètres.</Notice>}
      <div className="grid max-w-5xl gap-6">
        <section className="surface grid gap-5 p-6" aria-labelledby="h-id">
          <h2 id="h-id" className="text-[18px]">Identité</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nom du client"><Input disabled={!editable} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
            <Field label="Secteur"><Input disabled={!editable} value={f.secteur} onChange={(e) => setF({ ...f, secteur: e.target.value })} /></Field>
          </div>
          {me?.is_platform_admin && <label className="flex items-center gap-3"><Switch label="Client actif" checked={f.actif} onChange={(v) => setF({ ...f, actif: v })} /><span>Client actif <span className="text-fg-3">(un client inactif n&apos;est visible que de l&apos;administrateur plateforme)</span></span></label>}
          {editable && <div><Button variant="primary" disabled={!identDirty || !f.nom.trim()} loading={busy === "id"} onClick={() => save("id", { nom: f.nom, secteur: f.secteur, actif: f.actif })}>Enregistrer l&apos;identité</Button></div>}
        </section>

        <section className="surface grid gap-5 p-6" aria-labelledby="h-pf">
          <div><h2 id="h-pf" className="text-[18px]">Plateformes SIEM / XDR</h2><p className="text-fg-3">Une règle peut être écrite pour chacune. Ajouter une plateforme copie les règles des templates qui existent pour elle.</p></div>
          <Loading error={siems.error} loading={siems.loading && !siems.data} />
          {editable ? <PlatformPicker siems={siems.data ?? []} value={sel} onChange={setSel} onCreated={siems.reload} /> : <p>{client.siems.map((s) => s.nom).join(", ")}</p>}
          {editable && <div className="flex items-center gap-3"><Button variant="primary" disabled={!siemsDirty || !sel.length} loading={busy === "pf"} onClick={() => save("pf", { siems: sel })}>Enregistrer les plateformes</Button>{!sel.length && <span className="text-[13px] text-err">Gardez au moins une plateforme.</span>}</div>}
        </section>

        <section className="surface grid gap-5 p-6" aria-labelledby="h-dom">
          <div><h2 id="h-dom" className="text-[18px]">Domaines</h2><p className="text-fg-3">Cocher un nouveau domaine ajoute ses templates aux détections du client. Décocher un domaine garde les détections déjà présentes.</p></div>
          <Loading error={domaines.error} loading={domaines.loading && !domaines.data} />
          <DomainPicker domaines={domaines.data ?? []} value={dom} onChange={editable ? setDom : () => {}} />
          {editable && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled={!domDirty || !dom.length} loading={busy === "dom"} onClick={() => save("dom", { domaines: dom })}>Enregistrer les domaines</Button>
              {nbNouvelles > 0 && <span className="text-[13px] text-fg-2">{plural(nbNouvelles, "détection")} seront ajoutées en brouillon.</span>}
            </div>
          )}
        </section>

        {me?.is_platform_admin && (
          <section className="grid gap-3 rounded-xl border border-err/40 p-6" aria-labelledby="h-danger">
            <h2 id="h-danger" className="text-[18px] text-err">Supprimer ce client</h2>
            <p className="text-fg-3">Supprime définitivement le client, ses {plural(client.nb_detections ?? 0, "détection")}, ses règles et ses tests. La bibliothèque de templates n&apos;est pas touchée.</p>
            <div><Button variant="danger" onClick={async () => {
              if (!(await confirm({ title: `Supprimer ${client.nom} ?`, description: "Cette action est définitive.", confirmLabel: "Supprimer définitivement", danger: true, typeToConfirm: client.nom }))) return;
              try {
                await fetchDelete(id, client.nom);
                await ws.reload(); toast.success(`${client.nom} supprimé.`); router.push("/clients");
              } catch (e) { toast.error(errMsg(e)); }
            }}>Supprimer {client.nom}</Button></div>
          </section>
        )}
      </div>
    </>
  );
}

async function fetchDelete(id: string, nom: string) {
  await api(`/clients/${id}`, { method: "DELETE", body: { confirmation: nom } });
}
