"use client";
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { get, qs } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { STATUTS, STATUT_LABEL, statutColor } from "@/lib/status";
import { cn } from "@/lib/cn";
import type { DetectionItem, MatrixData } from "@/lib/types";
import { Loading, PageHeader } from "@/components/ui/basics";
import AttackCanvas from "@/components/AttackCanvas";
import { useClient } from "../ClientProvider";

type Uncovered = { identifiant: string; nom: string; templates: { code: string; cas_usage: string; etat: string }[] };

export default function Couverture({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { client } = useClient();
  const [statuts, setStatuts] = useState<string[]>(["deployee"]);
  const r = useAsync(() => get<MatrixData & { non_couvertes: Uncovered[] }>(`/clients/${id}/couverture${qs({ statuts: statuts.join(",") })}`), [id, statuts.join(",")]);
  const dets = useAsync(() => get<DetectionItem[]>(`/clients/${id}/detections`), [id]);
  const byCode = useMemo(() => new Map((dets.data ?? []).map((d) => [d.code, d.id])), [dets.data]);
  const toggle = (s: string) => setStatuts(statuts.includes(s) ? (statuts.length > 1 ? statuts.filter((x) => x !== s) : statuts) : [...statuts, s]);
  const [showGaps, setShowGaps] = useState(false);

  return (
    <>
      <PageHeader title="Couverture MITRE ATT&CK" subtitle={`Ce que les détections de ${client.nom} couvrent, selon leur avancement. Par défaut, seules les détections déployées comptent.`} />
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Statuts pris en compte">
        <span className="mr-1 text-[13px] text-fg-3">Compter les détections</span>
        {[...STATUTS].reverse().map((s) => {
          const on = statuts.includes(s.id), c = statutColor(s.id);
          return (
            <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(s.id)}
              className={cn("inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors", on ? "text-fg" : "border-line text-fg-3 hover:text-fg-2")}
              style={on ? { borderColor: `color-mix(in srgb, ${c} 55%, transparent)`, background: `color-mix(in srgb, ${c} 14%, transparent)` } : undefined}>
              <span className="size-2.5 rounded-full" style={{ background: on ? c : "var(--line)" }} />{s.label}<span className="mono text-xs text-fg-3">{client.par_statut?.[s.id] ?? 0}</span>
            </button>
          );
        })}
      </div>
      <Loading error={r.error} loading={r.loading && !r.data} />
      {r.data && (
        <>
          <AttackCanvas data={r.data} defaultMode="count" scope={client.nom} detectionHref={(code) => (byCode.has(code) ? `/clients/${id}/detections/${byCode.get(code)}` : null)} />
          <section className="surface mt-6 p-5" aria-labelledby="h-gaps">
            <button className="flex w-full items-center justify-between text-left" onClick={() => setShowGaps(!showGaps)} aria-expanded={showGaps}>
              <span><h2 id="h-gaps" className="text-[17px]">Techniques non couvertes ({r.data.non_couvertes.length})</h2><span className="text-[13px] text-fg-3">Parmi celles que la bibliothèque sait détecter : ce qu&apos;il reste à faire avancer ou à ajouter.</span></span>
              <span className="text-[13px] text-accent">{showGaps ? "Masquer" : "Afficher"}</span>
            </button>
            {showGaps && (
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {r.data.non_couvertes.map((u) => (
                  <li key={u.identifiant} className="rounded-lg border border-line-soft p-3.5">
                    <p><span className="mono text-[13px] text-accent">{u.identifiant}</span> <span className="font-medium">{u.nom}</span></p>
                    <ul className="mt-2 grid gap-1">
                      {u.templates.map((t) => {
                        const [kind, st] = t.etat.split(":");
                        const did = byCode.get(t.code);
                        return (
                          <li key={t.code} className="flex items-center gap-2 text-[13px]">
                            {did ? <Link className="mono text-fg-2 hover:text-accent" href={`/clients/${id}/detections/${did}`}>{t.code}</Link> : <span className="mono text-fg-2">{t.code}</span>}
                            <span className="min-w-0 flex-1 truncate text-fg-3">{t.cas_usage}</span>
                            {kind === "chez_le_client" && <span className="rounded-full px-2 py-px text-xs" style={{ color: statutColor(st), background: `color-mix(in srgb, ${statutColor(st)} 14%, transparent)` }}>{STATUT_LABEL[st]}</span>}
                            {kind === "a_ajouter" && <span className="rounded-full bg-accent-soft px-2 py-px text-xs text-accent">à ajouter</span>}
                            {kind === "hors_domaine" && <span className="rounded-full bg-panel-3 px-2 py-px text-xs text-fg-3">hors domaines</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
