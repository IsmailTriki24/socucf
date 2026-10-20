"use client";
import { useEffect, useMemo, useState } from "react";
import { Flame, Lightbulb, Plus, ShieldOff, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { GRAVITES, TYPES } from "@/lib/status";
import type { Domaine } from "@/lib/types";
import { Button, Field, Input, Segmented, Select, Textarea } from "../ui/basics";

export type FicheValues = {
  cas_usage: string; domaine_id: number; type_detection: string; gravite: string; logs_a_collecter: string; logique: string;
  exclusions: string; recommandation: string; impact: string; params: Record<string, string | number>; notes?: string;
  listes_reference?: Record<string, string[]>;
};

const norm = (v: FicheValues) => JSON.stringify({ ...v, params: Object.entries(v.params).map(([k, x]) => [k, String(x)]) });

function Tile({ icon, title, hint, value, onChange, disabled, tone }: { icon: React.ReactNode; title: string; hint: string; value: string; onChange: (v: string) => void; disabled: boolean; tone: string }) {
  return (
    <section className="surface flex flex-col overflow-hidden" aria-label={title}>
      <header className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3">
        <span className="grid size-7 place-items-center rounded-md" style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}>{icon}</span>
        <div className="min-w-0"><h3 className="text-[15px] font-semibold leading-tight">{title}</h3></div>
        {!value.trim() && <span className="ml-auto rounded-full bg-panel-3 px-2 py-0.5 text-xs text-fg-3">vide</span>}
      </header>
      <Textarea disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} rows={7} placeholder={hint} className="min-h-40 flex-1 rounded-none border-0 bg-transparent focus:shadow-none" aria-label={title} />
    </section>
  );
}

/** Onglet « Fiche » : tous les champs d'un template ou d'une détection, avec barre d'enregistrement. */
export default function FicheEditor({ initial, versionKey, domaines, editable, kind, nonResolus, onSave }: {
  initial: FicheValues; versionKey: string; domaines: Domaine[]; editable: boolean; kind: "detection" | "template"; nonResolus: string[]; onSave: (v: FicheValues) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [newList, setNewList] = useState("");
  useEffect(() => setV(initial), [versionKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = useMemo(() => norm(v) !== norm(initial), [v, initial]);
  const set = <K extends keyof FicheValues>(k: K, val: FicheValues[K]) => setV((x) => ({ ...x, [k]: val }));

  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    try { await onSave(v); } finally { setBusy(false); }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } };
    const leave = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("keydown", key); window.addEventListener("beforeunload", leave);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("beforeunload", leave); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const paramKeys = Object.keys(v.params);
  const manquants = nonResolus.filter((n) => !(n in v.params));

  return (
    <div className="grid gap-6 pb-24">
      <div className="surface grid gap-5 p-5">
        <Field label="Cas d'usage : l'attaque à détecter"><Input disabled={!editable} value={v.cas_usage} onChange={(e) => set("cas_usage", e.target.value)} maxLength={300} className="h-11 text-[16px] font-medium" /></Field>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Field label="Domaine" className="min-w-56"><Select disabled={!editable} value={v.domaine_id} onChange={(e) => set("domaine_id", Number(e.target.value))}>{domaines.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}</Select></Field>
          <Field label="Gravité" group><Segmented size="sm" value={v.gravite} onChange={(g) => editable && set("gravite", g)} options={GRAVITES.map((g) => ({ value: g, label: g, color: `var(--sev-${g.toLowerCase()})` }))} /></Field>
          <Field label="Type" group><Segmented size="sm" value={v.type_detection} onChange={(g) => editable && set("type_detection", g)} options={TYPES.map((g) => ({ value: g, label: g }))} /></Field>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label="Logs à collecter"><Textarea disabled={!editable} rows={5} value={v.logs_a_collecter} onChange={(e) => set("logs_a_collecter", e.target.value)} /></Field>
          <Field label="Logique de la règle (SI … ALORS …)"><Textarea disabled={!editable} rows={5} value={v.logique} onChange={(e) => set("logique", e.target.value)} /></Field>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Tile icon={<ShieldOff className="size-4" />} tone="var(--st-a_revoir)" title="Exclusions" disabled={!editable} value={v.exclusions} onChange={(x) => set("exclusions", x)}
          hint={"Ce qui ne doit pas déclencher l'alerte :\ncomptes de service, scanners, outils de déploiement, postes de test…"} />
        <Tile icon={<Lightbulb className="size-4" />} tone="var(--st-en_test)" title="Recommandation" disabled={!editable} value={v.recommandation} onChange={(x) => set("recommandation", x)}
          hint={"Que faire quand l'alerte se déclenche ?\nPremières vérifications, actions de remédiation, durcissement conseillé…"} />
        <Tile icon={<Flame className="size-4" />} tone="var(--sev-critique)" title="Impact" disabled={!editable} value={v.impact} onChange={(x) => set("impact", x)}
          hint={"Pourquoi c'est grave :\nce que l'attaquant obtient, systèmes touchés, conséquences métier…"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface p-5" aria-labelledby="h-params">
          <h3 id="h-params" className="text-[15px] font-semibold">Paramètres de la règle</h3>
          <p className="mb-3 text-[13px] text-fg-3">Seuils et fenêtres, utilisables dans les règles avec <span className="mono">{"{{nom}}"}</span>.</p>
          {manquants.length > 0 && editable && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-[13px]">
              <span>Utilisés dans les règles, sans valeur :</span>
              {manquants.map((m) => <button key={m} type="button" onClick={() => set("params", { ...v.params, [m]: "" })} className="mono rounded bg-warn/20 px-1.5 py-0.5 hover:bg-warn/30">{`{{${m}}}`} +</button>)}
            </div>
          )}
          <div className="grid gap-2">
            {paramKeys.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <label htmlFor={`p-${k}`} className="mono w-40 shrink-0 truncate text-[13px] text-fg-2">{k}</label>
                <Input id={`p-${k}`} disabled={!editable} className="mono" value={String(v.params[k])} onChange={(e) => set("params", { ...v.params, [k]: e.target.value })} />
                {editable && <button type="button" aria-label={`Retirer ${k}`} className="text-fg-3 hover:text-err" onClick={() => { const n = { ...v.params }; delete n[k]; set("params", n); }}><X className="size-4" /></button>}
              </div>
            ))}
            {!paramKeys.length && <p className="text-[13px] text-fg-3">Aucun paramètre.</p>}
          </div>
          {editable && (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const k = newList.trim(); if (k && !(k in v.params)) { set("params", { ...v.params, [k]: "" }); setNewList(""); } }}>
              <Input className="mono" placeholder="nouveau_parametre" value={newList} onChange={(e) => setNewList(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} aria-label="Nom du nouveau paramètre" />
              <Button type="submit" icon={<Plus className="size-4" />} disabled={!newList}>Ajouter</Button>
            </form>
          )}
        </section>

        {kind === "detection" ? (
          <section className="surface p-5" aria-labelledby="h-lists">
            <h3 id="h-lists" className="text-[15px] font-semibold">Listes de référence et notes</h3>
            <p className="mb-3 text-[13px] text-fg-3">Comptes admin, serveurs, IOC : une valeur par ligne, utilisable dans les règles par <span className="mono">{"{{nom_liste}}"}</span>.</p>
            <div className="grid gap-3">
              {Object.keys(v.listes_reference ?? {}).map((k) => (
                <Field key={k} label={k}>
                  <Textarea disabled={!editable} rows={3} className="mono text-[12.5px]" value={(v.listes_reference![k] ?? []).join("\n")}
                    onChange={(e) => set("listes_reference", { ...v.listes_reference, [k]: e.target.value.split("\n") })} />
                </Field>
              ))}
              {editable && <ListAdder onAdd={(k) => set("listes_reference", { ...(v.listes_reference ?? {}), [k]: [] })} exists={(k) => k in (v.listes_reference ?? {})} />}
              <Field label="Notes"><Textarea disabled={!editable} rows={3} value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
            </div>
          </section>
        ) : <div />}
      </div>

      {editable && (
        <div className={cn("fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border bg-panel px-4 py-2.5 shadow-[var(--shadow-pop)] transition-all", dirty ? "anim-pop border-accent/60 opacity-100" : "pointer-events-none translate-y-4 border-line opacity-0")} role="status" aria-hidden={!dirty}>
          <span className="size-2 rounded-full bg-warn" /><span className="text-[14px]">Modifications non enregistrées</span>
          <Button onClick={() => setV(initial)} disabled={busy}>Annuler</Button>
          <Button variant="primary" loading={busy} onClick={save}>Enregistrer <span className="kbd ml-1 border-accent-ink/30 bg-transparent text-accent-ink/70">Ctrl S</span></Button>
        </div>
      )}
    </div>
  );
}

function ListAdder({ onAdd, exists }: { onAdd: (k: string) => void; exists: (k: string) => boolean }) {
  const [k, setK] = useState("");
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (k && !exists(k)) { onAdd(k); setK(""); } }}>
      <Input className="mono" placeholder="liste_admins" value={k} onChange={(e) => setK(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} aria-label="Nom de la nouvelle liste" />
      <Button type="submit" icon={<Plus className="size-4" />} disabled={!k}>Nouvelle liste</Button>
    </form>
  );
}
