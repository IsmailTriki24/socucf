"use client";
import { useAuth } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/ui/basics";
import AuditTable from "@/components/AuditTable";

export default function GlobalAudit() {
  const { me } = useAuth();
  if (me && !me.is_platform_admin) return <Notice kind="err">Réservé à l&apos;Administrateur plateforme.</Notice>;
  return (<><PageHeader title="Journal global" subtitle="Chaque écriture sur la plateforme : qui, quand, quoi. Le journal est en ajout seul." /><AuditTable path="/audit" showClient /></>);
}
