"use client";
import { useState } from "react";
import { FileSpreadsheet, Network, Upload } from "lucide-react";
import { api, get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMsg, useAsync } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { Button, Loading, Notice, PageHeader } from "@/components/ui/basics";

type Report = {
  dry_run: boolean; fichier: string; nb_erreurs: number; nb_avertissements: number;
  compteurs: Record<string, number>; anomalies: { niveau: string; feuille: string; ligne: number | null; message: string }[];
};
const LABELS: [string, string][] = [["templates_crees", "Templates créés"], ["templates_mis_a_jour", "Mis à jour"], ["templates_inchanges", "Inchangés"], ["templates_rejetes", "Rejetés"], ["sources_creees", "Sources créées"], ["sources_mises_a_jour", "Sources mises à jour"], ["domaines_crees", "Domaines créés"], ["techniques_creees", "Techniques non référencées"]];

function Drop({ file, onFile, accept, label }: { file: File | null; onFile: (f: File | null) => void; accept: string; label: string }) {
  const [over, setOver] = useState(false);
  return (
    <label onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files?.[0] ?? null); }}
      className={cn("grid cursor-pointer place-items-center gap-1 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors", over ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50")}>
      <Upload className="size-6 text-fg-3" />
      <span className="font-medium">{file ? file.name : label}</span>
      <span className="text-[13px] text-fg-3">{file ? `${(file.size / 1024).toFixed(0)} Ko` : "Glissez le fichier ici ou cliquez pour le choisir"}</span>
      <input type="file" hidden accept={accept} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}

export default function Imports() {
  const { me } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [attack, setAttack] = useState<{ version_attack: string; techniques_creees: number; techniques_mises_a_jour: number; tactiques: number; techniques_inconnues_du_referentiel: string[] } | null>(null);
  const [aFile, setAFile] = useState<File | null>(null);
  const status = useAsync(() => get<{ version_attack: string | null; nb_verifiees: number; nb_techniques: number }>("/catalogue/attack/impacts"), []);
  if (me && !me.is_catalogue_manager) return <Notice kind="err">Réservé au Responsable catalogue.</Notice>;

  async function run(dry: boolean) {
    if (!file) return;
    setBusy(dry ? "sim" : "imp"); setErr(null); setDone(null);
    try {
      const form = new FormData(); form.append("fichier", file); form.append("dry_run", dry ? "true" : "false");
      setReport(await api<Report>("/catalogue/import", { form }));
      if (!dry) setDone("Import effectué.");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(null); }
  }
  async function runAttack() {
    if (!aFile) return;
    setBusy("att"); setErr(null);
    try { const form = new FormData(); form.append("fichier", aFile); setAttack(await api("/catalogue/attack", { form })); status.reload(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(null); }
  }
  return (
    <>
      <PageHeader title="Imports" subtitle="Le catalogue Excel et le référentiel MITRE ATT&CK." />
      {err && <Notice kind="err" className="mb-5">{err}</Notice>}{done && <Notice kind="ok" className="mb-5">{done}</Notice>}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="surface grid content-start gap-4 p-6">
          <h2 className="flex items-center gap-2.5 text-[18px]"><FileSpreadsheet className="size-5 text-st-deployee" />Catalogue Excel</h2>
          <p className="text-[13.5px] text-fg-3">Feuilles Detections, Sources_logs et Lisez-moi. La simulation montre ce qui serait créé, mis à jour ou rejeté sans rien écrire. Attention : un import réel écrase le contenu des templates existants avec celui du fichier.</p>
          <Drop file={file} onFile={(f) => { setFile(f); setReport(null); }} accept=".xlsx" label="Fichier Excel du catalogue" />
          <div className="flex gap-2"><Button disabled={!file} loading={busy === "sim"} onClick={() => run(true)}>Simuler l&apos;import</Button><Button variant="primary" disabled={!file || !report?.dry_run} loading={busy === "imp"} onClick={() => run(false)}>Importer pour de bon</Button></div>
          {report && (
            <div className="grid gap-4 border-t border-line-soft pt-4">
              <Notice kind={report.dry_run ? "info" : "ok"}>{report.dry_run ? "Simulation : aucune donnée écrite." : "Import réel effectué."} Fichier : {report.fichier}</Notice>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{LABELS.map(([k, l]) => <div key={k} className="surface-2 px-3 py-2.5"><div className="text-[22px] font-bold leading-none tabular-nums">{report.compteurs[k] ?? 0}</div><div className="mt-1 text-xs text-fg-3">{l}</div></div>)}</div>
              <h3 className="text-[14px] font-semibold">Anomalies : {report.nb_erreurs} erreur(s), {report.nb_avertissements} avertissement(s)</h3>
              {report.anomalies.length === 0 ? <p className="text-fg-3">Aucune anomalie.</p> : (
                <ul className="scroll-thin grid max-h-80 gap-1.5 overflow-y-auto">
                  {report.anomalies.map((a, i) => <li key={i} className="flex gap-2.5 rounded-md border border-line-soft px-3 py-2 text-[13px]"><span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.niveau === "erreur" ? "bg-err" : "bg-warn")} /><span><span className="text-fg-3">{a.feuille}{a.ligne ? `, ligne ${a.ligne}` : ""} : </span>{a.message}</span></li>)}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="surface grid content-start gap-4 p-6">
          <h2 className="flex items-center gap-2.5 text-[18px]"><Network className="size-5 text-st-validee" />Référentiel MITRE ATT&CK</h2>
          <Loading error={status.error} loading={status.loading && !status.data} />
          {status.data && <p>{status.data.version_attack ? <>Version chargée : <b>v{status.data.version_attack}</b>, {status.data.nb_verifiees} techniques vérifiées sur {status.data.nb_techniques}.</> : <b>Aucun référentiel chargé.</b>}</p>}
          <p className="text-[13.5px] text-fg-3">Fichier <span className="mono">enterprise-attack-19.2.json</span> du dépôt mitre-attack/attack-stix-data, ou commande <span className="mono">manage.py import_attack --download</span>.</p>
          <Drop file={aFile} onFile={setAFile} accept=".json" label="Bundle STIX (.json)" />
          <div><Button variant="primary" disabled={!aFile} loading={busy === "att"} onClick={runAttack}>Charger le bundle</Button></div>
          {attack && <div className="grid gap-2"><Notice kind="ok">v{attack.version_attack} : {attack.techniques_creees} créées, {attack.techniques_mises_a_jour} mises à jour, {attack.tactiques} tactiques.</Notice>
            {attack.techniques_inconnues_du_referentiel.length > 0 && <Notice kind="warn">Identifiants inconnus de cette version : {attack.techniques_inconnues_du_referentiel.join(", ")}</Notice>}</div>}
        </section>
      </div>
    </>
  );
}
