"use client";
import Link from "next/link";
import { ClientMark, ReadinessStrip, SiemMark } from "./marks";
import { STATUTS, statutColor } from "@/lib/status";
import type { ClientLite } from "@/lib/types";

/** En-tête d'un espace client : identité, plateformes, et la bande d'avancement de toutes ses détections. */
export default function ClientHeader({ client, onPick }: { client: ClientLite; onPick?: (statut: string) => void }) {
  const total = client.nb_detections ?? 0;
  return (
    <header className="mb-6 grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <ClientMark nom={client.nom} size={52} />
          <div className="min-w-0">
            <h1 className="truncate text-[28px] leading-tight">{client.nom}</h1>
            <p className="text-fg-3">{client.secteur || "Secteur non renseigné"}{!client.actif && <span className="ml-2 rounded bg-err/15 px-1.5 py-0.5 text-xs text-err">inactif</span>}</p>
          </div>
        </div>
        <Link href={`/clients/${client.id}/parametres`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 hover:border-accent/50" title="Modifier les plateformes">
          <span className="text-[13px] text-fg-3">Plateformes</span>
          <span className="flex gap-1.5">{client.siems.map((s) => <SiemMark key={s.code} code={s.code} nom={s.nom} size={24} />)}</span>
        </Link>
      </div>
      <div className="grid gap-2.5">
        <ReadinessStrip items={(client.bande ?? []).map((statut) => ({ statut }))} height={22} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {STATUTS.map((s) => {
            const n = client.par_statut?.[s.id] ?? 0;
            return (
              <button key={s.id} type="button" onClick={() => onPick?.(s.id)} disabled={!onPick} className="flex items-center gap-2 text-[13.5px] enabled:hover:text-fg disabled:cursor-default">
                <span className="size-2.5 rounded-[3px]" style={{ background: statutColor(s.id), opacity: s.id === "brouillon" ? 0.55 : 1 }} />
                <span className="text-fg-2">{s.label}</span><b className="tabular-nums">{n}</b>
                {total > 0 && <span className="text-xs text-fg-3">{Math.round((n / total) * 100)}%</span>}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
