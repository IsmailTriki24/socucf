"use client";
import { use, useState } from "react";
import { FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { download } from "@/lib/api";
import { errMsg } from "@/lib/hooks";
import { Button, PageHeader } from "@/components/ui/basics";
import { useClient } from "../ClientProvider";

export default function Exports({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { client } = useClient();
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (key: string, path: string, name: string) => { setBusy(key); try { await download(path, name); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); } };
  const cards = [
    { key: "xlsx", icon: <FileSpreadsheet className="size-6" />, color: "var(--st-deployee)", title: "Excel", file: "uc_factory.xlsx", path: `/clients/${id}/export.xlsx`, primary: true,
      text: "Le format du catalogue (Detections, Sources_logs, Lisez-moi) avec le statut, la journalisation, les règles de chaque plateforme, le hunting, les exclusions, la recommandation et l'impact. Les paramètres {{seuil}} sont remplacés par les valeurs du client." },
    { key: "nav", icon: <FileJson className="size-6" />, color: "var(--st-validee)", title: "Layer ATT&CK Navigator", file: "navigator.json", path: `/clients/${id}/export.navigator.json`,
      text: "Un fichier JSON : score = nombre de détections déployées par technique. Dans ATT&CK Navigator : Open Existing Layer, puis Upload from local." },
    { key: "csv", icon: <FileText className="size-6" />, color: "var(--st-en_test)", title: "CSV", file: "uc_factory.csv", path: `/clients/${id}/export.csv`,
      text: "Mêmes colonnes que l'Excel, séparateur point-virgule, UTF-8 avec BOM." },
  ];
  return (
    <>
      <PageHeader title="Exports" subtitle={`Sortir les détections de ${client.nom} vers vos outils.`} />
      <div className="grid gap-5 lg:grid-cols-3">
        {cards.map((c) => (
          <section key={c.key} className="surface flex flex-col gap-4 p-6">
            <span className="grid size-12 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${c.color} 16%, transparent)`, color: c.color }}>{c.icon}</span>
            <div className="flex-1"><h2 className="text-[18px]">{c.title}</h2><p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-3">{c.text}</p></div>
            <Button variant={c.primary ? "primary" : "secondary"} loading={busy === c.key} onClick={() => go(c.key, c.path, c.file)}>Télécharger</Button>
          </section>
        ))}
      </div>
    </>
  );
}
