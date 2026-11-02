"use client";
import { use, useState } from "react";
import { FileJson, FileSpreadsheet, FileText, FileType2 } from "lucide-react";
import { toast } from "sonner";
import { download, qs } from "@/lib/api";
import { errMsg } from "@/lib/hooks";
import { STATUTS, statutColor, type StatutId } from "@/lib/status";
import { cn } from "@/lib/cn";
import { Button, Checkbox, PageHeader, Switch } from "@/components/ui/basics";
import { useClient } from "../ClientProvider";

export default function Exports({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { client } = useClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [statuts, setStatuts] = useState<Set<StatutId>>(new Set(STATUTS.map((s) => s.id)));
  const [technique, setTechnique] = useState(true);
  const go = async (key: string, path: string, name: string) => { setBusy(key); try { await download(path, name); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); } };
  const toggle = (s: StatutId) => setStatuts((cur) => { const n = new Set(cur); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const tous = statuts.size === STATUTS.length;
  const pdfPath = `/clients/${id}/export.pdf${qs({ statuts: tous ? undefined : STATUTS.filter((s) => statuts.has(s.id)).map((s) => s.id).join(","), technique: technique ? undefined : 0 })}`;

  const cards = [
    { key: "xlsx", icon: <FileSpreadsheet className="size-6" />, color: "var(--st-deployee)", title: "Excel", file: "uc_factory.xlsx", path: `/clients/${id}/export.xlsx`,
      text: "Le format du catalogue (Detections, Sources_logs, Lisez-moi) avec le statut, la journalisation, les règles de chaque plateforme, le hunting, les exclusions, la recommandation et l'impact. Les paramètres {{seuil}} sont remplacés par les valeurs du client." },
    { key: "nav", icon: <FileJson className="size-6" />, color: "var(--st-validee)", title: "Layer ATT&CK Navigator", file: "navigator.json", path: `/clients/${id}/export.navigator.json`,
      text: "Un fichier JSON : score = nombre de détections déployées par technique. Dans ATT&CK Navigator : Open Existing Layer, puis Upload from local." },
    { key: "csv", icon: <FileText className="size-6" />, color: "var(--st-en_test)", title: "CSV", file: "uc_factory.csv", path: `/clients/${id}/export.csv`,
      text: "Mêmes colonnes que l'Excel, séparateur point-virgule, UTF-8 avec BOM." },
  ];
  return (
    <>
      <PageHeader title="Exports" subtitle={`Sortir les détections de ${client.nom} vers vos outils.`} />

      <section className="surface mb-5 grid gap-6 p-6 lg:grid-cols-[1fr_minmax(320px,420px)]" aria-labelledby="h-pdf">
        <div className="flex gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}><FileType2 className="size-6" /></span>
          <div>
            <h2 id="h-pdf" className="text-[18px]">Document PDF</h2>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-fg-3">
              Un document prêt à transmettre : page de garde, synthèse (statuts, gravités, domaines), sommaire avec numéros de page, puis une fiche par détection
              (logique de la règle avec impact, recommandation et exclusions, ATT&amp;CK, paramètres, règles par plateforme, hunting, tests). Les paramètres {"{{seuil}}"} sont remplacés par les valeurs du client.
            </p>
            <p className="mt-2 text-[13px] text-fg-3">Pour une seule détection, utilisez le bouton PDF de sa page ; pour quelques-unes, sélectionnez-les dans la liste des détections.</p>
          </div>
        </div>
        <div className="grid content-start gap-4">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-fg-2">Statuts inclus</legend>
            <div className="flex flex-wrap gap-2">
              {STATUTS.map((s) => (
                <label key={s.id} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] transition-colors", statuts.has(s.id) ? "border-line bg-panel-2 text-fg" : "border-line-soft text-fg-3")}>
                  <Checkbox checked={statuts.has(s.id)} onChange={() => toggle(s.id)} label={s.label} />
                  <span className="size-2 rounded-full" style={{ background: statutColor(s.id) }} />{s.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-[13.5px]">
            <span><span className="text-fg">Règles et requêtes de hunting</span><span className="block text-[12.5px] text-fg-3">Désactivez pour un document de synthèse sans code.</span></span>
            <Switch checked={technique} onChange={setTechnique} label="Inclure les règles et le hunting" />
          </label>
          <Button variant="primary" loading={busy === "pdf"} disabled={statuts.size === 0} onClick={() => go("pdf", pdfPath, "detections.pdf")}>
            {statuts.size === 0 ? "Choisissez au moins un statut" : "Télécharger le PDF"}
          </Button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {cards.map((c) => (
          <section key={c.key} className="surface flex flex-col gap-4 p-6">
            <span className="grid size-12 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${c.color} 16%, transparent)`, color: c.color }}>{c.icon}</span>
            <div className="flex-1"><h2 className="text-[18px]">{c.title}</h2><p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-3">{c.text}</p></div>
            <Button loading={busy === c.key} onClick={() => go(c.key, c.path, c.file)}>Télécharger</Button>
          </section>
        ))}
      </div>
    </>
  );
}
