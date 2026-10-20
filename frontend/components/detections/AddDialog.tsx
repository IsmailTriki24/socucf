"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";
import { get, post } from "@/lib/api";
import { errMsg, useAsync } from "@/lib/hooks";
import { GRAVITES, TYPES } from "@/lib/status";
import { cn } from "@/lib/cn";
import type { Domaine } from "@/lib/types";
import { Button, Field, Input, Loading, Notice, Segmented, Select } from "../ui/basics";
import { Modal } from "../ui/overlay";
import { SeverityBars } from "../domain/marks";

type Lib = { code: string; domaine: string; domaine_id: number; cas_usage: string; gravite: string; type_detection: string; dans_domaines: boolean };

export default function AddDialog({ clientId, open, onOpenChange, onDone }: { clientId: number; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"bibliotheque" | "libre">("bibliotheque");
  const lib = useAsync(() => (open ? get<Lib[]>(`/clients/${clientId}/bibliotheque`) : Promise.resolve([] as Lib[])), [clientId, open]);
  const domaines = useAsync(() => get<Domaine[]>("/domaines"), []);
  const [q, setQ] = useState("");
  const [dom, setDom] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [libre, setLibre] = useState({ cas_usage: "", domaine_id: 0, gravite: "Moyenne", type_detection: "Simple" });

  const list = useMemo(() => (lib.data ?? [])
    .filter((t) => (!dom || String(t.domaine_id) === dom) && (!q || `${t.code} ${t.cas_usage}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(b.dans_domaines) - Number(a.dans_domaines) || a.code.localeCompare(b.code)), [lib.data, q, dom]);
  const toggle = (code: string) => setSel((s) => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n; });

  async function submit() {
    setBusy(true); setErr(null);
    try {
      if (mode === "bibliotheque") {
        const r = await post<{ crees: number }>(`/clients/${clientId}/detections`, { codes: [...sel] });
        toast.success(`${r.crees} détection(s) ajoutée(s) en brouillon.`);
        setSel(new Set()); onDone(); onOpenChange(false);
      } else {
        const r = await post<{ ids: number[] }>(`/clients/${clientId}/detections`, { libre: { ...libre, cas_usage: libre.cas_usage.trim() } });
        toast.success("Détection créée : complétez-la.");
        onDone(); onOpenChange(false); router.push(`/clients/${clientId}/detections/${r.ids[0]}`);
      }
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  const ready = mode === "bibliotheque" ? sel.size > 0 : libre.cas_usage.trim().length > 0 && libre.domaine_id > 0;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Ajouter des détections" size="xl"
      description="Copiez des templates de la bibliothèque, ou créez une détection propre à ce client."
      footer={<><Button onClick={() => onOpenChange(false)}>Annuler</Button><Button variant="primary" disabled={!ready} loading={busy} onClick={submit}>{mode === "bibliotheque" ? `Ajouter ${sel.size || ""} détection${sel.size > 1 ? "s" : ""}` : "Créer la détection"}</Button></>}>
      <div className="mb-4"><Segmented value={mode} onChange={setMode} options={[{ value: "bibliotheque", label: "Depuis la bibliothèque" }, { value: "libre", label: "Détection libre" }]} /></div>
      {err && <Notice kind="err" className="mb-4">{err}</Notice>}
      {mode === "bibliotheque" ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-fg-3" /><Input autoFocus className="pl-9" placeholder="Chercher un code ou un cas d'usage…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher" /></div>
            <Select className="w-56" value={dom} onChange={(e) => setDom(e.target.value)} aria-label="Domaine"><option value="">Tous les domaines</option>{domaines.data?.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}</Select>
            {list.length > 0 && <Button onClick={() => setSel(new Set(list.map((t) => t.code)))}>Cocher les {list.length}</Button>}
          </div>
          <Loading error={lib.error} loading={lib.loading && !lib.data} />
          {lib.data && lib.data.length === 0 && <Notice kind="ok">Ce client a déjà tous les templates de la bibliothèque.</Notice>}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t) => {
              const on = sel.has(t.code);
              return (
                <button key={t.code} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(t.code)}
                  className={cn("grid gap-1.5 rounded-lg border p-3 text-left transition-colors", on ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50")}>
                  <span className="flex items-center gap-2"><span className="mono text-xs text-fg-2">{t.code}</span><SeverityBars gravite={t.gravite} /><span className={cn("ml-auto grid size-[18px] place-items-center rounded-[5px] border", on ? "border-accent bg-accent text-accent-ink" : "border-line")}>{on && <Check className="size-3" strokeWidth={4} />}</span></span>
                  <span className="line-clamp-2 text-[14px] font-medium leading-snug">{t.cas_usage}</span>
                  <span className="text-xs text-fg-3">{t.domaine}{!t.dans_domaines && " (hors domaines du client)"}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid max-w-2xl gap-5">
          <Field label="Cas d'usage (l'attaque à détecter)"><Input autoFocus value={libre.cas_usage} onChange={(e) => setLibre({ ...libre, cas_usage: e.target.value })} maxLength={300} placeholder="Ex. Connexion à l'ERP depuis un pays inhabituel" /></Field>
          <Field label="Domaine"><Select value={libre.domaine_id} onChange={(e) => setLibre({ ...libre, domaine_id: Number(e.target.value) })}><option value={0}>Choisir…</option>{domaines.data?.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}</Select></Field>
          <div className="flex flex-wrap gap-6">
            <Field label="Gravité" group><Segmented value={libre.gravite} onChange={(v) => setLibre({ ...libre, gravite: v })} options={GRAVITES.map((g) => ({ value: g, label: g }))} /></Field>
            <Field label="Type" group><Segmented value={libre.type_detection} onChange={(v) => setLibre({ ...libre, type_detection: v })} options={TYPES.map((g) => ({ value: g, label: g }))} /></Field>
          </div>
          <p className="text-[13px] text-fg-3">Le code (CLI-001…) est attribué automatiquement. Vous complétez ensuite les règles, exclusions, recommandation et impact.</p>
        </div>
      )}
    </Modal>
  );
}
