"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { STATUTS, statutColor } from "@/lib/status";
import { plural } from "@/lib/format";
import { Button, PageHeader } from "@/components/ui/basics";
import { ClientMark, ReadinessStrip, SiemMark } from "@/components/domain/marks";

export default function Clients() {
  const { me } = useAuth();
  const { clients, current } = useWorkspace();
  const router = useRouter();
  return (
    <>
      <PageHeader title="Clients" subtitle="Chaque client a ses propres détections, sa journalisation et sa couverture ATT&CK."
        actions={me?.is_platform_admin && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => router.push("/clients/nouveau")}>Nouveau client</Button>} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {clients?.map((c) => {
          const total = c.nb_detections ?? 0;
          const dep = c.par_statut?.deployee ?? 0;
          return (
            <Link key={c.id} href={`/clients/${c.id}`} className="surface group grid gap-4 p-5 transition-colors hover:border-accent/60" aria-current={current?.id === c.id}>
              <div className="flex items-center gap-3.5">
                <ClientMark nom={c.nom} size={44} />
                <div className="min-w-0 flex-1"><h2 className="truncate text-[18px] group-hover:text-accent">{c.nom}</h2><p className="truncate text-[13px] text-fg-3">{c.secteur || "Secteur non renseigné"}</p></div>
                {!c.actif && <span className="rounded bg-err/15 px-1.5 py-0.5 text-xs text-err">inactif</span>}
              </div>
              <ReadinessStrip items={(c.bande ?? []).map((statut) => ({ statut }))} height={14} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                {STATUTS.filter((s) => c.par_statut?.[s.id]).map((s) => <span key={s.id} className="flex items-center gap-1.5 text-fg-2"><span className="size-2 rounded-[2px]" style={{ background: statutColor(s.id) }} />{c.par_statut![s.id]} {s.label.toLowerCase()}</span>)}
                {!total && <span className="text-fg-3">Aucune détection</span>}
              </div>
              <div className="flex items-center justify-between border-t border-line-soft pt-3">
                <span className="flex gap-1.5">{c.siems.map((s) => <SiemMark key={s.code} code={s.code} nom={s.nom} size={24} />)}</span>
                <span className="text-[13px] text-fg-3">{plural(total, "détection")}{total ? `, ${dep} déployée${dep > 1 ? "s" : ""}` : ""}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
