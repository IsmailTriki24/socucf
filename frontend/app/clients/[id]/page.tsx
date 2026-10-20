"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronDown, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { get, post } from "@/lib/api";
import { errMsg, useAsync } from "@/lib/hooks";
import { fmtDate, relTime } from "@/lib/format";
import { statutColor } from "@/lib/status";
import { cn } from "@/lib/cn";
import type { DetectionItem } from "@/lib/types";
import { Avatar, Button, Loading, Notice } from "@/components/ui/basics";
import { SeverityBars, StatusBar, StatusPill } from "@/components/domain/marks";
import ClientHeader from "@/components/domain/ClientHeader";
import { useClient } from "./ClientProvider";

type Dash = {
  domaines: { id: number; nom: string; total: number; deployees: number; journalisation_ok: number; par_statut?: Record<string, number> }[];
  sources_a_ajouter: { source_id: number; nom: string; nb_detections: number; a_activer: string }[];
  a_revoir: DetectionItem[]; tactiques: { shortname: string; nom: string; total: number; couvertes: number }[];
  nb_techniques_deployees: number; activite: { date: string; utilisateur: string; objet: string; action: string; objet_type: string }[];
};

function Ring({ value, total, size = 132 }: { value: number; total: number; size?: number }) {
  const r = (size - 14) / 2, c = 2 * Math.PI * r, pct = total ? value / total : 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel-3)" strokeWidth="10" />
        {pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ok)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} style={{ transition: "stroke-dasharray .6s ease" }} />}
      </svg>
      <div className="absolute text-center"><div className="text-[28px] font-bold leading-none tabular-nums">{Math.round(pct * 100)}%</div><div className="mt-1 text-xs text-fg-3">{value} sur {total}</div></div>
    </div>
  );
}

const ACTION: Record<string, string> = { creation: "a créé", modification: "a modifié", suppression: "a supprimé" };
const OBJ: Record<string, string> = { "clients.DetectionClient": "la détection", "clients.Client": "le client", "catalog.Syntaxe": "une règle", "catalog.RequeteHunting": "une requête de hunting", "clients.PreuveTest": "un test", "clients.DetectionSource": "une source", "accounts.Habilitation": "un accès" };

export default function Dashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { client, can, reload: reloadClient } = useClient();
  const router = useRouter();
  const sp = useSearchParams();
  const r = useAsync(() => get<Dash>(`/clients/${id}/dashboard`), [id]);
  const [openSrc, setOpenSrc] = useState<number | null>(null);
  const d = r.data;
  const base = `/clients/${id}`;
  const total = client.nb_detections ?? 0;
  const deployees = client.par_statut?.deployee ?? 0;
  const welcome = sp.get("bienvenue") === "1" || deployees === 0;

  async function addSource(sid: number, nom: string) {
    try {
      const res = await post<{ detections_passees_ok: number }>(`/clients/${id}/sources/${sid}/ajouter`);
      toast.success(`${nom} ajoutée : ${res.detections_passees_ok} détection(s) passent en journalisation OK.`);
      await Promise.all([r.reload(), reloadClient()]);
    } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <>
      <ClientHeader client={client} onPick={(s) => router.push(`${base}/detections?statut=${s}`)} />
      <Loading error={r.error} loading={r.loading && !d} />
      {welcome && total > 0 && (
        <section className="surface mb-6 overflow-hidden" style={{ background: "linear-gradient(120deg, color-mix(in srgb, var(--accent) 14%, var(--panel)), var(--panel) 60%)" }}>
          <div className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-accent"><Sparkles className="size-4" /><span className="text-[13px] font-medium">Pour démarrer</span></div>
              <h2 className="mt-1 text-xl">{total} détections sont prêtes, en brouillon.</h2>
              <ol className="mt-3 grid gap-1.5 text-fg-2">
                <li className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-panel-3 text-xs font-semibold">1</span>Vérifiez la journalisation : ajoutez les sources de logs qui manquent.</li>
                <li className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-panel-3 text-xs font-semibold">2</span>Ouvrez les détections Critique et Haute, adaptez les règles à ses plateformes.</li>
                <li className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-panel-3 text-xs font-semibold">3</span>Faites-les avancer : En test, Validé, puis Déployé.</li>
              </ol>
            </div>
            <Link href={`${base}/detections`} className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 font-semibold text-accent-ink hover:bg-accent-hover">Ouvrir les détections<ArrowRight className="size-4" /></Link>
          </div>
        </section>
      )}
      {!total && <Notice kind="warn" className="mb-6" action={can("detection.edit") ? <Link className="font-medium underline" href={`${base}/detections`}>Ajouter des détections</Link> : undefined}>Ce client n&apos;a encore aucune détection.</Notice>}

      {d && (
        <div className="grid gap-5 lg:grid-cols-12">
          <section className="surface p-5 lg:col-span-5" aria-labelledby="h-journal">
            <h2 id="h-journal" className="text-[17px]">Journalisation</h2>
            <p className="text-fg-3">Détections dont les logs arrivent dans le SIEM.</p>
            <div className="mt-4 flex items-center gap-6">
              <Ring value={client.journalisation_ok ?? 0} total={total} />
              <div className="grid flex-1 gap-1.5 text-[13.5px]">
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-ok" />OK</span><b className="tabular-nums">{client.journalisation_ok ?? 0}</b></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full border border-fg-3" />Non</span><b className="tabular-nums">{total - (client.journalisation_ok ?? 0)}</b></div>
                <Link href={`${base}/detections?journalisation=non`} className="mt-1 text-accent hover:underline">Voir celles à corriger</Link>
              </div>
            </div>
            <div className="mt-5 border-t border-line-soft pt-4">
              <h3 className="mb-2 text-[13px] font-medium text-fg-3">Sources à ajouter en priorité</h3>
              {d.sources_a_ajouter.length === 0 ? <p className="flex items-center gap-2 text-ok"><CheckCircle2 className="size-4" />Toutes les sources utiles sont ajoutées.</p> : (
                <ul className="grid gap-1.5">
                  {d.sources_a_ajouter.map((s) => (
                    <li key={s.source_id} className="rounded-lg border border-line-soft bg-bg-2/60">
                      <div className="flex items-center gap-3 px-3 py-2">
                        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpenSrc(openSrc === s.source_id ? null : s.source_id)} aria-expanded={openSrc === s.source_id}>
                          <ChevronDown className={cn("size-4 shrink-0 text-fg-3 transition-transform", openSrc === s.source_id && "rotate-180")} />
                          <span className="min-w-0"><span className="block truncate font-medium">{s.nom}</span><span className="block text-xs text-fg-3">débloque {s.nb_detections} détection(s)</span></span>
                        </button>
                        {can("detection.edit") && <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => addSource(s.source_id, s.nom)}>Ajouter</Button>}
                      </div>
                      {openSrc === s.source_id && <div className="border-t border-line-soft px-3 py-2.5 text-[13px] leading-relaxed text-fg-2"><b className="text-fg">À activer :</b> {s.a_activer || "Aucune indication renseignée."}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="surface p-5 lg:col-span-7" aria-labelledby="h-att">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="h-att" className="text-[17px]">Couverture ATT&CK des détections déployées</h2><p className="text-fg-3">{d.nb_techniques_deployees} technique(s) couverte(s), par tactique.</p></div>
              <Link href={`${base}/couverture`} className="inline-flex items-center gap-1 text-[13.5px] text-accent hover:underline">Ouvrir la matrice<ArrowRight className="size-3.5" /></Link>
            </div>
            <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {d.tactiques.map((t) => (
                <li key={t.shortname} className="grid gap-1">
                  <div className="flex items-baseline justify-between text-[13px]"><span className="truncate text-fg-2">{t.nom}</span><span className="mono text-xs text-fg-3">{t.couvertes}/{t.total}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-panel-3"><div className="h-full rounded-full" style={{ width: `${(t.couvertes / Math.max(t.total, 1)) * 100}%`, background: statutColor("deployee") }} /></div>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface p-5 lg:col-span-7" aria-labelledby="h-dom">
            <h2 id="h-dom" className="text-[17px]">Avancement par domaine</h2>
            <ul className="mt-4 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {d.domaines.map((x) => (
                <li key={x.id}>
                  <Link href={`${base}/detections?domaine=${x.id}`} className="group grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-3"><span className="truncate font-medium group-hover:text-accent">{x.nom}</span><span className="shrink-0 text-xs text-fg-3"><b className="text-st-deployee">{x.deployees}</b> déployées sur {x.total}</span></div>
                    <StatusBar counts={{ deployee: x.deployees, brouillon: x.total - x.deployees }} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface p-5 lg:col-span-5" aria-labelledby="h-rev">
            <h2 id="h-rev" className="text-[17px]">À revoir</h2>
            {d.a_revoir.length === 0 ? <p className="mt-3 text-fg-3">Rien à reprendre pour le moment.</p> : (
              <ul className="mt-3 grid gap-1.5">
                {d.a_revoir.map((x) => (
                  <li key={x.id}><Link href={`${base}/detections/${x.id}`} className="flex items-center gap-3 rounded-lg border border-line-soft px-3 py-2 hover:border-accent/50">
                    <span className="mono w-16 shrink-0 text-xs text-fg-3">{x.code}</span><span className="min-w-0 flex-1 truncate">{x.cas_usage}</span><SeverityBars gravite={x.gravite} />
                  </Link></li>
                ))}
              </ul>
            )}
          </section>

          {d.activite.length > 0 && (
            <section className="surface p-5 lg:col-span-12" aria-labelledby="h-act">
              <h2 id="h-act" className="text-[17px]">Activité récente</h2>
              <ol className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
                {d.activite.map((a, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Avatar name={a.utilisateur} size={30} />
                    <p className="min-w-0 flex-1 truncate"><b className="font-medium">{a.utilisateur}</b> <span className="text-fg-3">{ACTION[a.action] ?? a.action} {OBJ[a.objet_type] ?? ""}</span> <span className="mono text-[13px]">{a.objet.replace(/^.* · /, "")}</span></p>
                    <time className="shrink-0 text-xs text-fg-3" title={fmtDate(a.date, true)}>{relTime(a.date)}</time>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </>
  );
}
