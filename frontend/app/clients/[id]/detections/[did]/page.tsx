"use client";
import { Suspense, use, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, del, get, patch, post, put } from "@/lib/api";
import { errMsg, useAsync } from "@/lib/hooks";
import { fmtDate, relTime } from "@/lib/format";
import { STATUTS, STATUT_LABEL } from "@/lib/status";
import type { DetectionFull, Domaine, Tactique, SourceLog } from "@/lib/types";
import { Avatar, Button, Field, Input, Loading, Notice, Segmented, TabBar } from "@/components/ui/basics";
import { useConfirm } from "@/components/ui/overlay";
import { JournalLed, PipelineMeter, SeverityBars, StatusPill } from "@/components/domain/marks";
import FicheEditor, { type FicheValues } from "@/components/editor/FicheEditor";
import RulesEditor, { type Guide, type Platform } from "@/components/editor/RulesEditor";
import HuntingEditor from "@/components/editor/HuntingEditor";
import SourcesPanel from "@/components/editor/SourcesPanel";
import TechniquePicker from "@/components/editor/TechniquePicker";
import TestsPanel from "@/components/editor/TestsPanel";
import { useClient } from "../../ClientProvider";

type Tab = "fiche" | "regles" | "hunting" | "journal" | "attack" | "tests";

function Detection({ id, did }: { id: string; did: string }) {
  const { client, can, reload: reloadClient } = useClient();
  const router = useRouter();
  const sp = useSearchParams();
  const confirm = useConfirm();
  const r = useAsync(() => get<DetectionFull>(`/detections/${did}`), [did]);
  const domaines = useAsync(() => get<Domaine[]>("/domaines"), []);
  const allSources = useAsync(() => get<SourceLog[]>("/sources-log"), []);
  const tactiques = useAsync(() => get<Tactique[]>("/tactiques"), []);
  const guide = useAsync(() => get<Guide>("/guide-traduction"), []);
  const tab = (sp.get("onglet") as Tab) || "fiche";
  const setTab = (t: Tab) => router.replace(`/clients/${id}/detections/${did}?onglet=${t}`, { scroll: false });
  const d = r.data;

  const platforms: Platform[] = useMemo(() => (d?.syntaxes ?? []).map((s) => ({
    siem: s.siem, nom: s.siem_nom, mode: s.mode_editeur, langage: s.langage, presente: !!s.presente, contenu: s.contenu,
    champs_requis: s.champs_requis, notes: s.notes, rendu: s.rendu, nonResolus: s.parametres_non_resolus,
  })), [d]);

  if (!d) return <Loading error={r.error} loading onRetry={r.reload} />;
  const editable = can("detection.edit");
  const base = `/clients/${id}`;
  const nonResolus = [...new Set(d.syntaxes.flatMap((s) => s.parametres_non_resolus ?? []))];
  const nbRegles = d.syntaxes.filter((s) => s.presente).length;
  const manque = d.journalisation === "non" ? d.sources.filter((s) => !s.collectee).length : 0;

  const apply = (res: DetectionFull) => { r.setData(res); reloadClient(); };
  const patchD = async (body: Record<string, unknown>) => { apply(await patch<DetectionFull>(`/detections/${d.id}`, body)); };
  const fail = (e: unknown) => toast.error(errMsg(e));

  const ficheInitial: FicheValues = {
    cas_usage: d.cas_usage, domaine_id: d.domaine_id, type_detection: d.type_detection, gravite: d.gravite, logs_a_collecter: d.logs_a_collecter,
    logique: d.logique, exclusions: d.exclusions, recommandation: d.recommandation, impact: d.impact, params: d.parametres, notes: d.notes, listes_reference: d.listes_reference,
  };

  async function setStatut(s: string) {
    try { await patchD({ statut: s }); toast.success(`${d!.code} : ${STATUT_LABEL[s]}`); } catch (e) { fail(e); }
  }

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-3 flex items-center gap-1.5 text-[13px] text-fg-3">
        <Link href={base} className="hover:text-fg">{client.nom}</Link><ChevronRight className="size-3.5" /><Link href={`${base}/detections`} className="hover:text-fg">Détections</Link><ChevronRight className="size-3.5" /><span className="mono text-fg-2">{d.code}</span>
      </nav>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="mono rounded-md border border-line bg-panel-2 px-2 py-0.5 text-[13px] font-medium">{d.code}</span>
          <SeverityBars gravite={d.gravite} showLabel /><span className="text-fg-3">{d.type_detection}</span><span className="text-fg-3">{d.domaine}</span>
          {d.libre && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">propre à ce client</span>}
        </div>
        <h1 className="mt-2 max-w-4xl text-[28px] leading-tight">{d.cas_usage}</h1>
      </header>

      <div className="grid gap-8 xl:grid-cols-[1fr_330px]">
        <div className="min-w-0">
          <TabBar<Tab> value={tab} onChange={setTab} tabs={[
            { id: "fiche", label: "Fiche", warn: !d.exclusions.trim() && !d.recommandation.trim() && !d.impact.trim() },
            { id: "regles", label: "Règles", count: `${nbRegles}/${d.syntaxes.length}` },
            { id: "hunting", label: "Hunting", count: d.hunting.length },
            { id: "journal", label: "Journalisation et sources", count: d.sources.length, warn: manque > 0 },
            { id: "attack", label: "ATT&CK", count: d.techniques.length },
            { id: "tests", label: "Tests", count: d.preuves.length },
          ]} />

          {tab === "fiche" && (
            <FicheEditor kind="detection" editable={editable} domaines={domaines.data ?? []} initial={ficheInitial} versionKey={`${d.id}:${d.modifie_le}`} nonResolus={nonResolus}
              onSave={async (v) => { try { await patchD({ cas_usage: v.cas_usage, domaine_id: v.domaine_id, type_detection: v.type_detection, gravite: v.gravite, logs_a_collecter: v.logs_a_collecter, logique: v.logique, exclusions: v.exclusions, recommandation: v.recommandation, impact: v.impact, parametres: Object.fromEntries(Object.entries(v.params).map(([k, x]) => [k, x !== "" && !isNaN(Number(x)) ? Number(x) : x])), listes_reference: Object.fromEntries(Object.entries(v.listes_reference ?? {}).map(([k, l]) => [k, l.map((x) => x.trim()).filter(Boolean)])), notes: v.notes ?? "" }); toast.success("Modifications enregistrées."); } catch (e) { fail(e); throw e; } }} />
          )}
          {tab === "regles" && (
            <RulesEditor platforms={platforms} editable={editable} guide={guide.data ?? []}
              onSave={async (siem, v) => { apply(await put<DetectionFull>(`/detections/${d.id}/syntaxes/${siem}`, v)); }}
              onDelete={async (siem) => { apply(await del<DetectionFull>(`/detections/${d.id}/syntaxes/${siem}`)); }} />
          )}
          {tab === "hunting" && (
            <HuntingEditor editable={editable} items={d.hunting} platforms={platforms.map((p) => ({ siem: p.siem, nom: p.nom, mode: p.mode }))}
              onCreate={async (h) => { apply(await post<DetectionFull>(`/detections/${d.id}/hunting`, h)); }}
              onUpdate={async (hid, h) => { apply(await patch<DetectionFull>(`/detections/${d.id}/hunting/${hid}`, h)); }}
              onDelete={async (hid) => { apply(await del<DetectionFull>(`/detections/${d.id}/hunting/${hid}`)); }} />
          )}
          {tab === "journal" && (
            <SourcesPanel editable={editable} sources={d.sources} allSources={allSources.data ?? []} client={{ journalisation: d.journalisation }}
              onSourcesChange={(rows) => patchD({ sources: rows })} onJournal={(v) => patchD({ journalisation: v })}
              onAjouter={async (sid, retirer) => {
                const res = await post<{ detections_passees_ok: number }>(`/clients/${id}/sources/${sid}/ajouter`, { retirer });
                toast.success(retirer ? "Source retirée." : `Source ajoutée${res.detections_passees_ok ? ` : ${res.detections_passees_ok} détection(s) passent en journalisation OK` : ""}.`);
                await r.reload(); reloadClient();
              }} />
          )}
          {tab === "attack" && <TechniquePicker editable={editable} techniques={d.techniques} tactiques={tactiques.data ?? []} onChange={async (ids) => { try { await patchD({ techniques: ids }); } catch (e) { fail(e); } }} />}
          {tab === "tests" && (
            <TestsPanel editable={editable} preuves={d.preuves}
              onAdd={async (f) => { apply(await api<DetectionFull>(`/detections/${d.id}/preuves`, { form: f })); }}
              onDelete={async (pid) => { await del(`/preuves/${pid}`); await r.reload(); }} />
          )}
        </div>

        <aside className="grid content-start gap-4 xl:sticky xl:top-2 xl:self-start" aria-label="Suivi de la détection">
          <section className="surface grid gap-4 p-5" aria-labelledby="h-statut">
            <div className="flex items-center justify-between"><h2 id="h-statut" className="text-[15px] font-semibold">Avancement</h2><StatusPill statut={d.statut} /></div>
            <PipelineMeter statut={d.statut} onChange={editable ? setStatut : undefined} />
            <p className="text-[13px] text-fg-3">{STATUTS.find((s) => s.id === d.statut)?.desc}. {editable && "Cliquez sur une étape pour changer le statut."}</p>
            {d.statut === "deployee" && (
              <div className="grid gap-3 border-t border-line-soft pt-4">
                <Field label="Date de déploiement"><Input type="date" disabled={!editable} defaultValue={d.date_deploiement ?? ""} key={d.date_deploiement ?? "x"} onBlur={(e) => e.target.value !== (d.date_deploiement ?? "") && patchD({ date_deploiement: e.target.value }).catch(fail)} /></Field>
                <Field label="Référence de la règle dans le SIEM" hint="Identifiant ou nom de la règle déployée."><Input disabled={!editable} defaultValue={d.reference_siem} key={d.reference_siem || "r"} onBlur={(e) => e.target.value !== d.reference_siem && patchD({ reference_siem: e.target.value }).catch(fail)} placeholder="Ex. analytic-rule-0142" /></Field>
              </div>
            )}
          </section>

          <section className="surface grid gap-3 p-5" aria-labelledby="h-jour">
            <div className="flex items-center justify-between"><h2 id="h-jour" className="text-[15px] font-semibold">Journalisation</h2><JournalLed value={d.journalisation} label /></div>
            <Segmented label="Journalisation" value={d.journalisation} onChange={(v) => editable && patchD({ journalisation: v }).catch(fail)} options={[{ value: "ok", label: "OK", color: "var(--ok)" }, { value: "non", label: "Non", color: "var(--err)" }]} />
            {manque > 0 && <p className="text-[13px] text-warn">{manque} source(s) à ajouter. <button className="underline" onClick={() => setTab("journal")}>Voir</button></p>}
          </section>

          <section className="surface grid gap-3 p-5 text-[13.5px]" aria-labelledby="h-suivi">
            <h2 id="h-suivi" className="text-[15px] font-semibold">Suivi</h2>
            <div className="flex items-center gap-2.5">{d.modifie_par ? <Avatar name={d.modifie_par} size={26} /> : null}<span className="text-fg-2">{d.modifie_par ? <>Modifiée par <b className="text-fg">{d.modifie_par}</b>, {relTime(d.modifie_le)}</> : "Jamais modifiée"}</span></div>
            {d.proprietaire && <p className="text-fg-3">Propriétaire : <span className="text-fg-2">{d.proprietaire}</span></p>}
            {d.template_code && <p className="text-fg-3">Copiée du template <Link className="mono text-accent hover:underline" href={`/templates/${d.template_code}`}>{d.template_code}</Link></p>}
            <time className="sr-only">{fmtDate(d.modifie_le, true)}</time>
          </section>

          {editable && (
            <div className="grid gap-2">
              {d.template_code && (
                <Button icon={<RotateCcw className="size-4" />} onClick={async () => {
                  if (!(await confirm({ title: "Réinitialiser depuis le template ?", description: "Le contenu, les règles et les paramètres de cette détection sont remplacés par ceux du template. Statut et journalisation sont conservés.", confirmLabel: "Réinitialiser", danger: true }))) return;
                  try { apply(await post<DetectionFull>(`/detections/${d.id}/reinitialiser`)); toast.success("Détection réinitialisée."); } catch (e) { fail(e); }
                }}>Réinitialiser depuis le template</Button>
              )}
              <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={async () => {
                if (!(await confirm({ title: `Supprimer ${d.code} ?`, description: "La détection disparaît de ce client, avec ses règles et ses tests.", confirmLabel: "Supprimer", danger: true }))) return;
                try { await del(`/detections/${d.id}`); reloadClient(); toast.success(`${d.code} supprimée.`); router.push(`${base}/detections`); } catch (e) { fail(e); }
              }}>Supprimer cette détection</Button>
            </div>
          )}
          {!editable && <Notice kind="info">Lecture seule pour votre rôle.</Notice>}
        </aside>
      </div>
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string; did: string }> }) {
  const { id, did } = use(params);
  return <Suspense fallback={<Loading loading />}><Detection key={did} id={id} did={did} /></Suspense>;
}
