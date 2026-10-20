"use client";
import { useState } from "react";
import { get, qs } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { GRAVITES } from "@/lib/status";
import type { Domaine, MatrixData, Siem } from "@/lib/types";
import { Loading, Notice, PageHeader, Select } from "@/components/ui/basics";
import AttackCanvas from "@/components/AttackCanvas";

export default function Mitre() {
  const [domaine, setDomaine] = useState("");
  const [gravite, setGravite] = useState("");
  const [siem, setSiem] = useState("");
  const domaines = useAsync(() => get<Domaine[]>("/domaines"), []);
  const siems = useAsync(() => get<Siem[]>("/siems"), []);
  const m = useAsync(() => get<MatrixData>(`/catalogue/couverture${qs({ domaine, gravite, siem })}`), [domaine, gravite, siem]);
  const impacts = useAsync(() => get<{ version_attack: string | null; impacts: { template: string; technique: string; remplacee_par: string }[]; nb_verifiees: number }>("/catalogue/attack/impacts"), []);
  return (
    <>
      <PageHeader title="Couverture ATT&CK de la bibliothèque" subtitle={`Ce que l'ensemble des templates sait détecter. Les sous-techniques sont regroupées sur leur technique.${impacts.data?.version_attack ? ` Référentiel ATT&CK v${impacts.data.version_attack}.` : ""}`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select className="w-60" value={domaine} onChange={(e) => setDomaine(e.target.value)} aria-label="Domaine"><option value="">Tous les domaines</option>{domaines.data?.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}</Select>
        <Select className="w-48" value={gravite} onChange={(e) => setGravite(e.target.value)} aria-label="Gravité"><option value="">Toutes les gravités</option>{GRAVITES.map((g) => <option key={g}>{g}</option>)}</Select>
        <Select className="w-64" value={siem} onChange={(e) => setSiem(e.target.value)} aria-label="Plateforme"><option value="">Toutes les plateformes</option>{siems.data?.map((s) => <option key={s.code} value={s.code}>Règle disponible : {s.nom}</option>)}</Select>
      </div>
      {impacts.data && impacts.data.impacts.length > 0 && (
        <Notice kind="warn" className="mb-4"><b>{impacts.data.impacts.length} lien(s) à revoir</b> (technique révoquée, obsolète ou inconnue) : {impacts.data.impacts.slice(0, 8).map((i) => <span key={i.template + i.technique} className="mono mr-2 rounded bg-warn/15 px-1.5 text-[12.5px]">{i.template} → {i.technique}{i.remplacee_par ? ` ⇒ ${i.remplacee_par}` : ""}</span>)}</Notice>
      )}
      <Loading error={m.error} loading={m.loading && !m.data} />
      {m.data && <AttackCanvas data={m.data} defaultMode="count" detectionHref={(code) => `/templates/${code}`} scope="bibliothèque" />}
    </>
  );
}
