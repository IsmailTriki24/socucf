"use client";
import { use } from "react";
import AuditTable from "@/components/AuditTable";
import { PageHeader } from "@/components/ui/basics";
import { useClient } from "../ClientProvider";

export default function Audit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { client } = useClient();
  return <><PageHeader title="Journal du client" subtitle={`Chaque modification chez ${client.nom} : qui, quand, quoi. Le journal est en ajout seul.`} /><AuditTable path={`/clients/${id}/audit`} /></>;
}
