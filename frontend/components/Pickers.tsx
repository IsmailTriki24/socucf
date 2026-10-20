"use client";
import { useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMsg } from "@/lib/hooks";
import { CATEGORIE_LABEL } from "@/lib/status";
import { cn } from "@/lib/cn";
import type { Domaine, Siem } from "@/lib/types";
import { Button, Checkbox, Chip, Field, Input, Select } from "./ui/basics";
import { SiemMark } from "./domain/marks";

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** Choix des plateformes SIEM / XDR d'un client, groupées par famille, avec ajout d'une plateforme maison. */
export function PlatformPicker({ siems, value, onChange, onCreated }: { siems: Siem[]; value: string[]; onChange: (v: string[]) => void; onCreated?: () => void }) {
  const { me } = useAuth();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState({ nom: "", categorie: "siem", langage_regle: "" });
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = siems.filter((s) => !needle || `${s.nom} ${s.langage_regle} ${s.code}`.toLowerCase().includes(needle));
    return ["siem", "xdr", "ndr", "generique"].map((c) => ({ cat: c, items: list.filter((s) => s.categorie === c) })).filter((g) => g.items.length);
  }, [siems, q]);

  async function addPlatform() {
    try {
      const code = custom.nom.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "").slice(0, 28) || `plateforme${Date.now()}`;
      const lang = custom.langage_regle.trim() || "À préciser";
      const s = await post<Siem>("/siems", { code, nom: custom.nom.trim(), categorie: custom.categorie, langage_regle: lang, langage_hunting: lang, mode_editeur: "text", ordre: 99 });
      onCreated?.();
      onChange([...value, s.code]); setAdding(false); setCustom({ nom: "", categorie: "siem", langage_regle: "" });
    } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-fg-3" /><Input className="pl-9" placeholder="Filtrer les plateformes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrer les plateformes" /></div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-label="Plateformes choisies">
          <span className="text-[13px] text-fg-3">{value.length ? `${value.length} choisie${value.length > 1 ? "s" : ""} :` : "Aucune plateforme choisie"}</span>
          {value.map((c) => { const s = siems.find((x) => x.code === c); return s && <Chip key={c} onRemove={() => onChange(value.filter((x) => x !== c))}>{s.nom}</Chip>; })}
        </div>
      </div>
      {groups.map((g) => (
        <div key={g.cat} className="grid gap-2.5">
          <h3 className="text-[13px] font-medium text-fg-3">{CATEGORIE_LABEL[g.cat]}</h3>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((s) => {
              const on = value.includes(s.code);
              return (
                <button key={s.id} type="button" role="checkbox" aria-checked={on} onClick={() => onChange(toggle(value, s.code))}
                  className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all", on ? "border-accent bg-accent-soft" : "border-line bg-bg-2/50 hover:border-accent/50")}>
                  <SiemMark code={s.code} nom={s.nom} size={34} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{s.nom}</span><span className="block truncate text-xs text-fg-3">{s.langage_regle}</span></span>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border transition-colors", on ? "border-accent bg-accent text-accent-ink" : "border-line")}>{on && <Check className="size-3" strokeWidth={4} />}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!groups.length && <p className="text-fg-3">Aucune plateforme ne correspond.</p>}
      {me?.is_catalogue_manager && (adding ? (
        <div className="surface-2 grid gap-3 p-4 sm:grid-cols-[1fr_190px_1fr_auto] sm:items-end">
          <Field label="Nom de la plateforme"><Input autoFocus value={custom.nom} onChange={(e) => setCustom({ ...custom, nom: e.target.value })} /></Field>
          <Field label="Famille"><Select value={custom.categorie} onChange={(e) => setCustom({ ...custom, categorie: e.target.value })}>{Object.entries(CATEGORIE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Langage des règles"><Input value={custom.langage_regle} onChange={(e) => setCustom({ ...custom, langage_regle: e.target.value })} placeholder="Ex. KQL" /></Field>
          <div className="flex gap-2"><Button variant="primary" disabled={!custom.nom.trim()} onClick={addPlatform}>Ajouter</Button><Button variant="ghost" onClick={() => setAdding(false)}>Annuler</Button></div>
        </div>
      ) : <Button className="w-fit" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Ma plateforme n&apos;est pas dans la liste</Button>)}
    </div>
  );
}

/** Choix des domaines : tout est coché tant que l'utilisateur n'a rien décoché. */
export function DomainPicker({ domaines, value, onChange, extra }: { domaines: Domaine[]; value: number[]; onChange: (v: number[]) => void; extra?: (d: Domaine) => React.ReactNode }) {
  return (
    <div className="grid gap-4">
      <div className="flex gap-2"><Button size="sm" onClick={() => onChange(domaines.map((d) => d.id))}>Tout cocher</Button><Button size="sm" onClick={() => onChange([])}>Tout décocher</Button></div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {domaines.map((d) => {
          const on = value.includes(d.id);
          return (
            <label key={d.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors", on ? "border-accent/60 bg-accent-soft" : "border-line bg-bg-2/50 hover:border-accent/40")}>
              <Checkbox checked={on} onChange={() => onChange(toggle(value, d.id))} label={d.nom} />
              <span className="min-w-0 flex-1 truncate font-medium">{d.nom}</span>
              {extra ? extra(d) : <span className="mono text-xs text-fg-3" title="Templates dans la bibliothèque">{d.nb_templates}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}
