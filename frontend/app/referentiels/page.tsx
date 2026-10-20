"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { del, get, patch, post, put } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMsg, useAsync } from "@/lib/hooks";
import { CATEGORIE_LABEL } from "@/lib/status";
import type { Domaine, Siem, SourceLog } from "@/lib/types";
import { Button, EmptyState, Field, Input, Loading, Notice, PageHeader, Select, TabBar, Textarea } from "@/components/ui/basics";
import { Modal, useConfirm } from "@/components/ui/overlay";
import { SiemMark } from "@/components/domain/marks";

type Tab = "plateformes" | "sources" | "domaines" | "guide" | "aide";
type Guide = { notion: string; siem: string; texte: string }[];

export default function Referentiels() {
  const { me } = useAuth();
  const confirm = useConfirm();
  const manager = !!me?.is_catalogue_manager;
  const [tab, setTab] = useState<Tab>("plateformes");
  const siems = useAsync(() => get<Siem[]>("/siems"), []);
  const sources = useAsync(() => get<SourceLog[]>("/sources-log"), []);
  const domaines = useAsync(() => get<Domaine[]>("/domaines"), []);
  const guide = useAsync(() => get<Guide>("/guide-traduction"), []);
  const aide = useAsync(() => get<{ section: string; titre: string; texte: string }[]>("/aide"), []);
  const [editSiem, setEditSiem] = useState<Partial<Siem> | null>(null);
  const [editSrc, setEditSrc] = useState<Partial<SourceLog> | null>(null);
  const [editDom, setEditDom] = useState<Partial<Domaine> | null>(null);
  const [qs, setQs] = useState("");
  const [gSiem, setGSiem] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string, done: () => void) => { setBusy(true); try { await fn(); toast.success(ok); done(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };

  const notions = useMemo(() => [...new Set((guide.data ?? []).map((g) => g.notion))], [guide.data]);
  const filteredSources = (sources.data ?? []).filter((s) => !qs || `${s.nom} ${s.a_activer}`.toLowerCase().includes(qs.toLowerCase()));

  return (
    <>
      <PageHeader title="Plateformes et sources" subtitle="Les SIEM et XDR pris en charge, les sources de logs avec la marche à suivre pour les ajouter, les domaines et le guide de traduction." />
      <TabBar<Tab> value={tab} onChange={setTab} tabs={[
        { id: "plateformes", label: "Plateformes SIEM / XDR", count: siems.data?.length }, { id: "sources", label: "Sources de logs", count: sources.data?.length },
        { id: "domaines", label: "Domaines", count: domaines.data?.length }, { id: "guide", label: "Guide de traduction" }, { id: "aide", label: "Aide" },
      ]} />
      {!manager && tab !== "aide" && <Notice kind="info" className="mb-5">Lecture seule : seuls le Responsable catalogue et l&apos;Administrateur plateforme modifient les référentiels.</Notice>}

      {tab === "plateformes" && (
        <>
          <Loading error={siems.error} loading={siems.loading && !siems.data} />
          {manager && <div className="mb-4"><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditSiem({ categorie: "siem", mode_editeur: "text", ordre: 99 })}>Ajouter une plateforme</Button></div>}
          {["siem", "xdr", "ndr", "generique"].map((cat) => {
            const items = (siems.data ?? []).filter((s) => s.categorie === cat);
            if (!items.length) return null;
            return (
              <section key={cat} className="mb-6">
                <h2 className="mb-3 text-[14px] font-medium text-fg-3">{CATEGORIE_LABEL[cat]}</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((s) => (
                    <article key={s.id} className="surface flex items-start gap-3.5 p-4">
                      <SiemMark code={s.code} nom={s.nom} size={40} />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[15px] font-semibold">{s.nom}</h3>
                        <p className="mt-0.5 text-[13px] text-fg-3"><span className="text-fg-2">Règles :</span> {s.langage_regle}</p>
                        <p className="text-[13px] text-fg-3"><span className="text-fg-2">Hunting :</span> {s.langage_hunting}</p>
                        <p className="mt-1.5 text-xs text-fg-3">{s.nb_clients ?? 0} client(s)</p>
                      </div>
                      {manager && <button aria-label={`Modifier ${s.nom}`} className="rounded p-1.5 text-fg-3 hover:bg-panel-2 hover:text-fg" onClick={() => setEditSiem(s)}><Pencil className="size-4" /></button>}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      {tab === "sources" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-80"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-fg-3" /><Input className="pl-9" placeholder="Chercher une source…" value={qs} onChange={(e) => setQs(e.target.value)} aria-label="Chercher une source" /></div>
            {manager && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditSrc({ nom: "", a_activer: "", evenements_cles: "", piege: "" })}>Ajouter une source</Button>}
          </div>
          <Loading error={sources.error} loading={sources.loading && !sources.data} />
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredSources.map((s) => (
              <article key={s.id} className="surface p-5">
                <header className="flex items-start gap-3"><h3 className="min-w-0 flex-1 text-[15px] font-semibold">{s.nom}</h3><span className="mono rounded bg-panel-3 px-1.5 text-xs text-fg-2" title="Détections de la bibliothèque qui l'utilisent">{s.nb_cas_usage}</span>
                  {manager && <button aria-label={`Modifier ${s.nom}`} className="rounded p-1 text-fg-3 hover:bg-panel-2 hover:text-fg" onClick={() => setEditSrc(s)}><Pencil className="size-4" /></button>}</header>
                <dl className="mt-3 grid gap-2.5 text-[13.5px] leading-relaxed">
                  <div><dt className="font-medium">À activer</dt><dd className="text-fg-2">{s.a_activer || "—"}</dd></div>
                  <div><dt className="font-medium">Événements ou champs clés</dt><dd className="mono text-[12.5px] text-fg-2">{s.evenements_cles || "—"}</dd></div>
                  <div><dt className="font-medium">Piège fréquent</dt><dd className="text-fg-2">{s.piege || "—"}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === "domaines" && (
        <>
          {manager && <div className="mb-4"><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditDom({ nom: "", ordre: 99 })}>Ajouter un domaine</Button></div>}
          <Loading error={domaines.error} loading={domaines.loading && !domaines.data} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {domaines.data?.map((d) => (
              <article key={d.id} className="surface flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><h3 className="truncate text-[15px] font-semibold">{d.nom}</h3><p className="text-[13px] text-fg-3">{d.nb_templates} template(s)</p></div>
                {manager && <button aria-label={`Modifier ${d.nom}`} className="rounded p-1.5 text-fg-3 hover:bg-panel-2 hover:text-fg" onClick={() => setEditDom(d)}><Pencil className="size-4" /></button>}</article>
            ))}
          </div>
        </>
      )}

      {tab === "guide" && (
        <div className="grid gap-4">
          <p className="max-w-2xl text-fg-3">Comment exprimer chaque notion (seuil, fenêtre, corrélation…) dans le langage de la plateforme. Ces repères s&apos;affichent dans l&apos;éditeur de règles.</p>
          <Select className="w-80" value={gSiem} onChange={(e) => setGSiem(e.target.value)} aria-label="Plateforme du guide"><option value="">Choisir une plateforme…</option>{siems.data?.map((s) => <option key={s.code} value={s.code}>{s.nom}</option>)}</Select>
          {gSiem && (
            <div className="grid gap-3 lg:grid-cols-2">
              {notions.map((n) => <GuideCell key={gSiem + n} notion={n} siem={gSiem} initial={guide.data?.find((g) => g.notion === n && g.siem === gSiem)?.texte ?? ""} editable={manager} onSaved={guide.setData} />)}
              {!notions.length && <EmptyState title="Aucune notion">Le fichier Excel du catalogue n&apos;a pas fourni de guide.</EmptyState>}
            </div>
          )}
        </div>
      )}

      {tab === "aide" && (
        <section className="surface grid max-w-3xl gap-5 p-6">
          {["principe", "etapes", "definitions"].map((sec) => (
            <div key={sec}><h2 className="mb-2 text-[16px]">{{ principe: "Principe", etapes: "Utilisation en 5 étapes", definitions: "Définitions" }[sec]}</h2>
              <div className="grid gap-2">{aide.data?.filter((a) => a.section === sec).map((a) => <p key={a.titre} className="leading-relaxed text-fg-2">{sec !== "principe" && <b className="text-fg">{a.titre} : </b>}{a.texte}</p>)}</div></div>
          ))}
        </section>
      )}

      <Modal open={!!editSiem} onOpenChange={(o) => !o && setEditSiem(null)} title={editSiem?.id ? `Modifier ${editSiem.nom}` : "Ajouter une plateforme"} size="md"
        footer={editSiem && <>
          {editSiem.id && <Button variant="danger" className="mr-auto" icon={<Trash2 className="size-4" />} onClick={async () => { if (await confirm({ title: `Supprimer ${editSiem.nom} ?`, description: `Les règles et requêtes de hunting écrites pour cette plateforme sont supprimées aussi, et ${editSiem.nb_clients ?? 0} client(s) la perdent.`, confirmLabel: "Supprimer", danger: true })) run(() => del(`/siems/${editSiem.id}`), "Plateforme supprimée.", () => { setEditSiem(null); siems.reload(); }); }}>Supprimer</Button>}
          <Button onClick={() => setEditSiem(null)}>Annuler</Button>
          <Button variant="primary" loading={busy} disabled={!editSiem.nom?.trim()} onClick={() => run(() => {
            const lang = editSiem.langage_regle?.trim() || "À préciser";
            const body = { nom: editSiem.nom!.trim(), categorie: editSiem.categorie, langage_regle: lang, langage_hunting: editSiem.langage_hunting?.trim() || lang, mode_editeur: editSiem.mode_editeur };
            return editSiem.id ? patch(`/siems/${editSiem.id}`, body) : post("/siems", { ...body, code: body.nom.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "").slice(0, 28) || `p${Date.now()}`, ordre: 99 });
          }, "Plateforme enregistrée.", () => { setEditSiem(null); siems.reload(); })}>Enregistrer</Button></>}>
        {editSiem && <div className="grid gap-4">
          <Field label="Nom"><Input autoFocus value={editSiem.nom ?? ""} onChange={(e) => setEditSiem({ ...editSiem, nom: e.target.value })} /></Field>
          <Field label="Famille"><Select value={editSiem.categorie} onChange={(e) => setEditSiem({ ...editSiem, categorie: e.target.value })}>{Object.entries(CATEGORIE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Langage des règles"><Input value={editSiem.langage_regle ?? ""} onChange={(e) => setEditSiem({ ...editSiem, langage_regle: e.target.value })} placeholder="Ex. KQL" /></Field>
            <Field label="Langage de hunting"><Input value={editSiem.langage_hunting ?? ""} onChange={(e) => setEditSiem({ ...editSiem, langage_hunting: e.target.value })} placeholder="Identique par défaut" /></Field>
          </div>
          <Field label="Coloration dans l'éditeur"><Select value={editSiem.mode_editeur} onChange={(e) => setEditSiem({ ...editSiem, mode_editeur: e.target.value })}><option value="text">Texte simple</option><option value="xml">XML</option><option value="sql">SQL / SPL</option><option value="yaml">YAML (Sigma)</option><option value="json">JSON</option></Select></Field>
        </div>}
      </Modal>

      <Modal open={!!editSrc} onOpenChange={(o) => !o && setEditSrc(null)} title={editSrc?.id ? `Modifier ${editSrc.nom}` : "Ajouter une source de logs"} size="lg"
        footer={editSrc && <>
          {editSrc.id && <Button variant="danger" className="mr-auto" icon={<Trash2 className="size-4" />} onClick={async () => { if (await confirm({ title: `Supprimer ${editSrc.nom} ?`, description: "Impossible tant que des détections ou templates l'utilisent.", confirmLabel: "Supprimer", danger: true })) run(() => del(`/sources-log/${editSrc.id}`), "Source supprimée.", () => { setEditSrc(null); sources.reload(); }); }}>Supprimer</Button>}
          <Button onClick={() => setEditSrc(null)}>Annuler</Button>
          <Button variant="primary" loading={busy} disabled={!editSrc.nom?.trim()} onClick={() => run(() => {
            const body = { nom: editSrc.nom!.trim(), a_activer: editSrc.a_activer ?? "", evenements_cles: editSrc.evenements_cles ?? "", piege: editSrc.piege ?? "" };
            return editSrc.id ? patch(`/sources-log/${editSrc.id}`, body) : post("/sources-log", { ...body, ordre: 99 });
          }, "Source enregistrée.", () => { setEditSrc(null); sources.reload(); })}>Enregistrer</Button></>}>
        {editSrc && <div className="grid gap-4">
          <Field label="Nom de la source"><Input autoFocus value={editSrc.nom ?? ""} onChange={(e) => setEditSrc({ ...editSrc, nom: e.target.value })} /></Field>
          <Field label="À activer / à collecter (comment l'ajouter)"><Textarea rows={4} value={editSrc.a_activer ?? ""} onChange={(e) => setEditSrc({ ...editSrc, a_activer: e.target.value })} /></Field>
          <Field label="Événements ou champs clés"><Textarea rows={2} value={editSrc.evenements_cles ?? ""} onChange={(e) => setEditSrc({ ...editSrc, evenements_cles: e.target.value })} /></Field>
          <Field label="Piège fréquent"><Textarea rows={3} value={editSrc.piege ?? ""} onChange={(e) => setEditSrc({ ...editSrc, piege: e.target.value })} /></Field>
        </div>}
      </Modal>

      <Modal open={!!editDom} onOpenChange={(o) => !o && setEditDom(null)} title={editDom?.id ? `Modifier ${editDom.nom}` : "Ajouter un domaine"} size="sm"
        footer={editDom && <>
          {editDom.id && <Button variant="danger" className="mr-auto" icon={<Trash2 className="size-4" />} onClick={async () => { if (await confirm({ title: `Supprimer ${editDom.nom} ?`, description: "Impossible tant qu'il contient des templates ou des détections.", confirmLabel: "Supprimer", danger: true })) run(() => del(`/domaines/${editDom.id}`), "Domaine supprimé.", () => { setEditDom(null); domaines.reload(); }); }}>Supprimer</Button>}
          <Button onClick={() => setEditDom(null)}>Annuler</Button>
          <Button variant="primary" loading={busy} disabled={!editDom.nom?.trim()} onClick={() => run(() => (editDom.id ? patch(`/domaines/${editDom.id}`, { nom: editDom.nom!.trim() }) : post("/domaines", { nom: editDom.nom!.trim(), ordre: 99 })), "Domaine enregistré.", () => { setEditDom(null); domaines.reload(); })}>Enregistrer</Button></>}>
        {editDom && <Field label="Nom du domaine"><Input autoFocus value={editDom.nom ?? ""} onChange={(e) => setEditDom({ ...editDom, nom: e.target.value })} /></Field>}
      </Modal>
    </>
  );
}

function GuideCell({ notion, siem, initial, editable, onSaved }: { notion: string; siem: string; initial: string; editable: boolean; onSaved: (g: Guide) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="surface grid gap-2 p-4">
      <h3 className="text-[14px] font-semibold">{notion}</h3>
      <Textarea disabled={!editable} rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder="À rédiger pour cette plateforme" />
      {editable && v !== initial && <div><Button size="sm" variant="primary" onClick={async () => { try { onSaved(await put<Guide>("/guide-traduction", { notion, siem, texte: v })); toast.success("Guide enregistré."); } catch (e) { toast.error(errMsg(e)); } }}>Enregistrer</Button></div>}
    </div>
  );
}
