"use client";
import { use, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { Suspense } from "react";
import { toast } from "sonner";
import { del, get, patch, post, put } from "@/lib/api";
import { errMsg, useAsync } from "@/lib/hooks";
import { relTime } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";
import type { Domaine, Siem, SourceLog, Tactique, TemplateFull } from "@/lib/types";
import { Button, Loading, Notice, TabBar } from "@/components/ui/basics";
import { Pop, useConfirm } from "@/components/ui/overlay";
import { SeverityBars } from "@/components/domain/marks";
import FicheEditor, { type FicheValues } from "@/components/editor/FicheEditor";
import RulesEditor, { type Guide, type Platform } from "@/components/editor/RulesEditor";
import HuntingEditor from "@/components/editor/HuntingEditor";
import SourcesPanel from "@/components/editor/SourcesPanel";
import TechniquePicker from "@/components/editor/TechniquePicker";

type Tab = "fiche" | "regles" | "hunting" | "sources" | "attack";

function TemplatePage({ code }: { code: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const confirm = useConfirm();
  const { clients } = useWorkspace();
  const r = useAsync(() => get<TemplateFull>(`/templates/${code}`), [code]);
  const siems = useAsync(() => get<Siem[]>("/siems"), []);
  const domaines = useAsync(() => get<Domaine[]>("/domaines"), []);
  const allSources = useAsync(() => get<SourceLog[]>("/sources-log"), []);
  const tactiques = useAsync(() => get<Tactique[]>("/tactiques"), []);
  const guide = useAsync(() => get<Guide>("/guide-traduction"), []);
  const tab = (sp.get("onglet") as Tab) || "fiche";
  const setTab = (t: Tab) => router.replace(`/templates/${code}?onglet=${t}`, { scroll: false });
  const t = r.data;

  const platforms: Platform[] = useMemo(() => (siems.data ?? []).map((s) => {
    const rule = t?.syntaxes.find((x) => x.siem === s.code);
    return { siem: s.code, nom: s.nom, mode: s.mode_editeur, langage: s.langage_regle, presente: !!rule, contenu: rule?.contenu ?? "", champs_requis: rule?.champs_requis ?? [], notes: rule?.notes ?? "" };
  }), [siems.data, t]);

  if (!t) return <Loading error={r.error} loading onRetry={r.reload} />;
  const editable = t.peut_modifier;
  const fail = (e: unknown) => toast.error(errMsg(e));
  const patchT = async (body: Record<string, unknown>) => { r.setData(await patch<TemplateFull>(`/templates/${code}`, body)); };
  const initial: FicheValues = { cas_usage: t.cas_usage, domaine_id: t.domaine_id, type_detection: t.type_detection, gravite: t.gravite, detections_similaires: t.detections_similaires, logs_a_collecter: t.logs_a_collecter, logique: t.logique, exclusions: t.exclusions, recommandation: t.recommandation, impact: t.impact, params: t.parametres_defaut };
  const writable = clients?.filter((c) => c.permissions["detection.edit"]) ?? [];

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-3 flex items-center gap-1.5 text-[13px] text-fg-3"><Link href="/templates" className="hover:text-fg">Templates</Link><ChevronRight className="size-3.5" /><span className="mono text-fg-2">{t.code}</span></nav>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><span className="mono rounded-md border border-line bg-panel-2 px-2 py-0.5 text-[13px] font-medium">{t.code}</span><SeverityBars gravite={t.gravite} showLabel /><span className="text-fg-3">{t.type_detection}</span><span className="text-fg-3">{t.domaine}</span></div>
          <h1 className="mt-2 max-w-4xl text-[28px] leading-tight">{t.cas_usage}</h1>
          <p className="mt-1.5 text-[13.5px] text-fg-3">Modifié {relTime(t.modifie_le)}{t.nb_clients !== undefined && <> · utilisé par {t.nb_clients} client(s)</>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {writable.length > 0 && (
            <Pop align="end" width={280} trigger={<Button icon={<Plus className="size-4" />}>Ajouter à un client</Button>}>
              {(close) => (
                <div className="grid gap-0.5">
                  <p className="px-2 py-1 text-xs font-medium text-fg-3">Copier ce template chez…</p>
                  {writable.map((c) => (
                    <button key={c.id} className="rounded-md px-2 py-1.5 text-left text-[13.5px] hover:bg-panel-2" onClick={async () => {
                      close();
                      try { const res = await post<{ ids: number[] }>(`/clients/${c.id}/detections`, { codes: [t.code] }); toast.success(`${t.code} ajouté chez ${c.nom}.`, { action: { label: "Ouvrir", onClick: () => router.push(`/clients/${c.id}/detections/${res.ids[0]}`) } }); } catch (e) { fail(e); }
                    }}>{c.nom}</button>
                  ))}
                </div>
              )}
            </Pop>
          )}
          {editable && <Button icon={<Copy className="size-4" />} onClick={async () => { try { const x = await post<{ code: string }>(`/templates/${code}/dupliquer`); toast.success(`${x.code} créé.`); router.push(`/templates/${x.code}`); } catch (e) { fail(e); } }}>Dupliquer</Button>}
          {editable && <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={async () => {
            if (!(await confirm({ title: `Supprimer ${t.code} ?`, description: "Les clients qui l'ont déjà copié gardent leur détection.", confirmLabel: "Supprimer", danger: true }))) return;
            try { await del(`/templates/${code}`); toast.success(`${t.code} supprimé.`); router.push("/templates"); } catch (e) { fail(e); }
          }}>Supprimer</Button>}
        </div>
      </header>
      {!editable && <Notice kind="info" className="mb-5">Lecture seule : seuls le Responsable catalogue et l&apos;Administrateur plateforme modifient la bibliothèque.</Notice>}
      <TabBar<Tab> value={tab} onChange={setTab} tabs={[
        { id: "fiche", label: "Fiche" }, { id: "regles", label: "Règles", count: t.syntaxes.length }, { id: "hunting", label: "Hunting", count: t.hunting.length },
        { id: "sources", label: "Sources de logs", count: t.sources.length }, { id: "attack", label: "ATT&CK", count: t.techniques.length },
      ]} />
      {tab === "fiche" && (
        <FicheEditor kind="template" editable={editable} domaines={domaines.data ?? []} initial={initial} versionKey={`${t.code}:${t.modifie_le}`} nonResolus={[]}
          onSave={async (v) => { try { await patchT({ cas_usage: v.cas_usage, domaine_id: v.domaine_id, type_detection: v.type_detection, gravite: v.gravite, detections_similaires: v.detections_similaires, logs_a_collecter: v.logs_a_collecter, logique: v.logique, exclusions: v.exclusions, recommandation: v.recommandation, impact: v.impact, parametres_defaut: Object.fromEntries(Object.entries(v.params).map(([k, x]) => [k, x !== "" && !isNaN(Number(x)) ? Number(x) : x])) }); toast.success("Template enregistré."); } catch (e) { fail(e); throw e; } }} />
      )}
      {tab === "regles" && (
        <RulesEditor platforms={platforms} editable={editable} guide={guide.data ?? []}
          onSave={async (siem, v) => { await put(`/templates/${code}/syntaxes/${siem}`, v); await r.reload(); }}
          onDelete={async (siem) => { await del(`/templates/${code}/syntaxes/${siem}`); await r.reload(); }} />
      )}
      {tab === "hunting" && (
        <HuntingEditor editable={editable} items={t.hunting.map((h) => ({ ...h, siem_nom: siems.data?.find((s) => s.code === h.siem)?.nom }))} platforms={(siems.data ?? []).map((s) => ({ siem: s.code, nom: s.nom, mode: s.mode_editeur }))}
          onCreate={async (h) => { await post(`/templates/${code}/hunting`, h); await r.reload(); }}
          onUpdate={async (id, h) => { await patch(`/hunting/${id}`, h); await r.reload(); }}
          onDelete={async (id) => { await del(`/hunting/${id}`); await r.reload(); }} />
      )}
      {tab === "sources" && <SourcesPanel editable={editable} sources={t.sources} allSources={allSources.data ?? []} onSourcesChange={(rows) => patchT({ sources: rows })} />}
      {tab === "attack" && <TechniquePicker editable={editable} techniques={t.techniques} tactiques={tactiques.data ?? []} onChange={async (ids) => { try { await patchT({ techniques: ids }); } catch (e) { fail(e); } }} />}
    </>
  );
}

export default function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <Suspense fallback={<Loading loading />}><TemplatePage key={code} code={code} /></Suspense>;
}
