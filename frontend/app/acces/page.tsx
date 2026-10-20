"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { del, get, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { errMsg, useAsync } from "@/lib/hooks";
import { ROLES_CLIENT, ROLE_LABELS } from "@/lib/status";
import { cn } from "@/lib/cn";
import { Avatar, Button, EmptyState, Input, Loading, Notice, PageHeader, Select } from "@/components/ui/basics";
import { useConfirm } from "@/components/ui/overlay";
import { ClientMark } from "@/components/domain/marks";

type Hab = { id: number; role: string; username: string; nom: string; email: string };
type Found = { id: number; username: string; nom: string; email: string };

export default function Acces() {
  const { me } = useAuth();
  const { clients, current } = useWorkspace();
  const confirm = useConfirm();
  const manageable = (clients ?? []).filter((c) => c.permissions["habilitation.manage"]);
  const [cid, setCid] = useState<number | null>(null);
  useEffect(() => { if (cid === null && manageable.length) setCid(manageable.find((c) => c.id === current?.id)?.id ?? manageable[0].id); }, [manageable, cid, current]);
  const habs = useAsync(() => (cid ? get<Hab[]>(`/clients/${cid}/habilitations`) : Promise.resolve([] as Hab[])), [cid]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [role, setRole] = useState("lecteur");

  if (clients && !manageable.length) return <Notice kind="err">Réservé à l&apos;Administrateur plateforme et aux Admin client.</Notice>;
  const client = manageable.find((c) => c.id === cid);
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); habs.reload(); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <>
      <PageHeader title="Utilisateurs et accès" subtitle="Qui peut voir et modifier quoi. Une même personne peut être Valideur chez un client et Lecteur chez un autre."
        actions={me?.is_platform_admin && <Link href="/admin/utilisateurs" className="inline-flex h-9 items-center rounded-md border border-line bg-panel-2 px-3.5 hover:border-accent/60">Gérer les comptes</Link>} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Clients" className="grid content-start gap-1">
          {manageable.map((c) => (
            <button key={c.id} onClick={() => setCid(c.id)} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors", c.id === cid ? "border-accent/60 bg-accent-soft" : "border-transparent hover:bg-panel-2")}>
              <ClientMark nom={c.nom} size={30} /><span className="truncate font-medium">{c.nom}</span>
            </button>
          ))}
        </nav>
        <div className="grid min-w-0 content-start gap-6">
          <Loading error={habs.error} loading={habs.loading && !habs.data} />
          {habs.data && (
            <section className="grid gap-3" aria-label={`Accès de ${client?.nom}`}>
              {habs.data.length === 0 && <EmptyState title="Personne n'a accès à ce client" icon={<UserPlus className="size-5" />}>Seuls les administrateurs plateforme le voient. Ajoutez des personnes ci-dessous.</EmptyState>}
              <div className="grid gap-3 sm:grid-cols-2">
                {habs.data.map((h) => {
                  const self = h.username === me?.username && !me?.is_platform_admin;
                  return (
                    <article key={h.id} className="surface flex items-center gap-3.5 p-4">
                      <Avatar name={h.nom} size={40} />
                      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{h.nom}</p><p className="mono truncate text-[12.5px] text-fg-3">{h.username}</p>
                        <Select className="mt-2 h-8 text-[13px]" disabled={self} value={h.role} aria-label={`Rôle de ${h.username}`} onChange={(e) => act(() => patch(`/habilitations/${h.id}`, { role: e.target.value }), "Rôle modifié.")}>{ROLES_CLIENT.map((x) => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}</Select></div>
                      <button disabled={self} aria-label={`Retirer l'accès de ${h.username}`} className="self-start rounded p-1 text-fg-3 hover:text-err disabled:opacity-30" onClick={async () => { if (await confirm({ title: `Retirer l'accès de ${h.nom} ?`, description: `Cette personne ne verra plus ${client?.nom}.`, confirmLabel: "Retirer", danger: true })) act(() => del(`/habilitations/${h.id}`), "Accès retiré."); }}><X className="size-4" /></button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          <section className="surface grid gap-3 p-5" aria-labelledby="h-add">
            <h2 id="h-add" className="text-[16px]">Donner l&apos;accès</h2>
            <p className="text-[13px] text-fg-3">Recherche par identifiant ou e-mail exact : la liste des comptes de la plateforme n&apos;est pas affichée.</p>
            <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); try { setFound(await get<Found[]>(`/users/lookup?q=${encodeURIComponent(q)}`)); } catch (e2) { toast.error(errMsg(e2)); } }}>
              <div className="relative w-72"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-fg-3" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="identifiant ou e-mail" aria-label="Chercher un utilisateur" /></div>
              <Button type="submit" disabled={!q.trim()}>Chercher</Button>
            </form>
            {found && found.length === 0 && <p className="text-fg-3">Aucun utilisateur trouvé.</p>}
            {found?.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft p-3">
                <Avatar name={u.nom} size={32} /><span className="min-w-0 flex-1"><b className="font-medium">{u.nom}</b> <span className="mono text-[12.5px] text-fg-3">{u.username}</span></span>
                <Select className="h-9 w-48" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rôle à donner">{ROLES_CLIENT.map((x) => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}</Select>
                <Button variant="primary" onClick={() => act(async () => { await post(`/clients/${cid}/habilitations`, { utilisateur_id: u.id, role }); setFound(null); setQ(""); }, `Accès donné à ${u.nom}.`)}>Donner l&apos;accès</Button>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
