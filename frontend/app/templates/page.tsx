"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Flame, Lightbulb, MoreHorizontal, Plus, Search, ShieldOff, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { del, get, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errMsg, useAsync } from "@/lib/hooks";
import { GRAVITES, TYPES, graviteColor } from "@/lib/status";
import { cn } from "@/lib/cn";
import type { Domaine, Siem, Tactique, TemplateItem } from "@/lib/types";
import { Button, EmptyState, Field, Input, Loading, PageHeader, Segmented, Select, Skeleton } from "@/components/ui/basics";
import { Menu, Modal, Tip, useConfirm } from "@/components/ui/overlay";
import { MultiFilter } from "@/components/detections/Filters";
import { SeverityBars, SiemMark } from "@/components/domain/marks";

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

function NewTemplate({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const domaines = useAsync(() => get<Domaine[]>("/domaines"), []);
  const [f, setF] = useState({ cas_usage: "", domaine_id: 0, gravite: "Moyenne", type_detection: "Simple" });
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Nouveau template" description="Un modèle de détection réutilisable. Les règles, exclusions et le reste se complètent ensuite."
      footer={<><Button onClick={() => onOpenChange(false)}>Annuler</Button><Button variant="primary" loading={busy} disabled={!f.cas_usage.trim() || !f.domaine_id} onClick={async () => {
        setBusy(true);
        try { const t = await post<{ code: string }>("/templates", { ...f, cas_usage: f.cas_usage.trim() }); toast.success(`${t.code} créé.`); router.push(`/templates/${t.code}`); } catch (e) { toast.error(errMsg(e)); setBusy(false); }
      }}>Créer le template</Button></>}>
      <div className="grid gap-5">
        <Field label="Cas d'usage : l'attaque à détecter"><Input autoFocus value={f.cas_usage} onChange={(e) => setF({ ...f, cas_usage: e.target.value })} maxLength={300} placeholder="Ex. Création d'un compte administrateur hors procédure" /></Field>
        <Field label="Domaine"><Select value={f.domaine_id} onChange={(e) => setF({ ...f, domaine_id: Number(e.target.value) })}><option value={0}>Choisir…</option>{domaines.data?.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}</Select></Field>
        <div className="flex flex-wrap gap-6">
          <Field label="Gravité" group><Segmented size="sm" value={f.gravite} onChange={(v) => setF({ ...f, gravite: v })} options={GRAVITES.map((g) => ({ value: g, label: g }))} /></Field>
          <Field label="Type" group><Segmented size="sm" value={f.type_detection} onChange={(v) => setF({ ...f, type_detection: v })} options={TYPES.map((g) => ({ value: g, label: g }))} /></Field>
        </div>
        <p className="text-[13px] text-fg-3">Le code (DET-083…) est attribué automatiquement.</p>
      </div>
    </Modal>
  );
}

function Library() {
  const { me } = useAuth();
  const sp = useSearchParams();
  const router = useRouter();
  const confirm = useConfirm();
  const manager = !!me?.is_catalogue_manager;
  const data = useAsync(() => get<TemplateItem[]>("/templates"), []);
  const domaines = useAsync(() => get<Domaine[]>("/domaines"), []);
  const siems = useAsync(() => get<Siem[]>("/siems"), []);
  const tactiques = useAsync(() => get<Tactique[]>("/tactiques"), []);
  const [creating, setCreating] = useState(false);
  const f = { q: sp.get("q") ?? "", domaine: list(sp.get("domaine")), gravite: list(sp.get("gravite")), type: list(sp.get("type")), tactique: list(sp.get("tactique")), plateforme: list(sp.get("plateforme")), complet: sp.get("complet") ?? "" };
  const setF = (p: Partial<Record<keyof typeof f, string | string[]>>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(p)) { const s = Array.isArray(v) ? v.join(",") : v ?? ""; if (s) n.set(k, s); else n.delete(k); }
    router.replace(`/templates${n.toString() ? "?" + n : ""}`, { scroll: false });
  };
  const items = data.data ?? [];
  const filtered = useMemo(() => items.filter((t) =>
    (!f.q || `${t.code} ${t.cas_usage} ${t.techniques.join(" ")}`.toLowerCase().includes(f.q.toLowerCase())) &&
    (!f.domaine.length || f.domaine.includes(String(t.domaine_id))) && (!f.gravite.length || f.gravite.includes(t.gravite)) &&
    (!f.type.length || f.type.includes(t.type_detection)) && (!f.tactique.length || t.tactiques.some((x) => f.tactique.includes(x))) &&
    (!f.plateforme.length || f.plateforme.some((p) => t.siems_regle.includes(p))) &&
    (!f.complet || (f.complet === "complet" ? t.a_exclusions && t.a_recommandation && t.a_impact : !(t.a_exclusions && t.a_recommandation && t.a_impact))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [items, sp.toString()]);
  const count = (fn: (t: TemplateItem) => string[]) => { const m: Record<string, number> = {}; items.forEach((t) => fn(t).forEach((k) => (m[k] = (m[k] ?? 0) + 1))); return m; };
  const nDom = count((t) => [String(t.domaine_id)]), nGr = count((t) => [t.gravite]), nTy = count((t) => [t.type_detection]), nTac = count((t) => t.tactiques), nPf = count((t) => t.siems_regle);
  const filtering = !!(f.q || f.domaine.length || f.gravite.length || f.type.length || f.tactique.length || f.plateforme.length || f.complet);

  async function remove(t: TemplateItem) {
    if (!(await confirm({ title: `Supprimer ${t.code} ?`, description: `Le template disparaît de la bibliothèque${t.nb_clients ? `. Les ${t.nb_clients} client(s) qui l'ont copié gardent leur détection` : ""}.`, confirmLabel: "Supprimer", danger: true }))) return;
    try { await del(`/templates/${t.code}`); toast.success(`${t.code} supprimé.`); data.reload(); } catch (e) { toast.error(errMsg(e)); }
  }
  async function duplicate(t: TemplateItem) {
    try { const r = await post<{ code: string }>(`/templates/${t.code}/dupliquer`); toast.success(`${r.code} créé à partir de ${t.code}.`); router.push(`/templates/${r.code}`); } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <>
      <PageHeader title="Templates de détection" subtitle="La bibliothèque commune : chaque client en reçoit une copie qu'il peut adapter. Tout est modifiable."
        actions={manager && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouveau template</Button>} />
      <div className="bleed top-0 z-20 mb-5 lg:sticky border-y border-line-soft bg-bg/90 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 max-w-xs flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-fg-3" /><Input className="pl-9" placeholder="Chercher code, cas d'usage, technique…" value={f.q} onChange={(e) => setF({ q: e.target.value })} aria-label="Chercher un template" /></div>
          <MultiFilter label="Domaine" searchable value={f.domaine} onChange={(v) => setF({ domaine: v })} options={(domaines.data ?? []).map((d) => ({ value: String(d.id), label: d.nom, count: nDom[String(d.id)] ?? 0 }))} />
          <MultiFilter label="Gravité" value={f.gravite} onChange={(v) => setF({ gravite: v })} options={GRAVITES.map((g) => ({ value: g, label: g, count: nGr[g] ?? 0, color: graviteColor(g) }))} />
          <MultiFilter label="Type" value={f.type} onChange={(v) => setF({ type: v })} options={TYPES.map((g) => ({ value: g, label: g, count: nTy[g] ?? 0 }))} />
          <MultiFilter label="Tactique ATT&CK" searchable value={f.tactique} onChange={(v) => setF({ tactique: v })} options={(tactiques.data ?? []).filter((t) => nTac[t.shortname]).map((t) => ({ value: t.shortname, label: t.nom, count: nTac[t.shortname] }))} />
          <MultiFilter label="Règle disponible pour" searchable value={f.plateforme} onChange={(v) => setF({ plateforme: v })} options={(siems.data ?? []).map((s) => ({ value: s.code, label: s.nom, count: nPf[s.code] ?? 0 }))} />
          <Segmented size="sm" label="Complétude" value={(f.complet || "tous") as "tous" | "complet" | "incomplet"} onChange={(v) => setF({ complet: v === "tous" ? "" : v })}
            options={[{ value: "tous", label: "Tous" }, { value: "complet", label: "Exclusions, reco et impact remplis" }, { value: "incomplet", label: "À compléter" }]} />
          {filtering && <Button variant="ghost" size="sm" icon={<X className="size-3.5" />} onClick={() => router.replace("/templates", { scroll: false })}>Effacer</Button>}
          <span className="ml-auto text-[13px] text-fg-3">{filtered.length}{filtering ? ` sur ${items.length}` : ""} template(s)</span>
        </div>
      </div>
      <Loading error={data.error} onRetry={data.reload} />
      {data.loading && !data.data && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>}
      {data.data && filtered.length === 0 && <EmptyState icon={<Search className="size-5" />} title="Aucun template ne correspond" action={filtering ? <Button onClick={() => router.replace("/templates", { scroll: false })}>Effacer les filtres</Button> : undefined}>Essayez avec moins de filtres.</EmptyState>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((t) => (
          <article key={t.code} className="group/card surface relative grid content-between gap-3 p-4 transition-colors hover:border-accent/50">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Link href={`/templates/${t.code}`} className="mono text-[12.5px] font-medium text-fg-2 after:absolute after:inset-0 hover:text-accent">{t.code}</Link>
                <SeverityBars gravite={t.gravite} /><span className="text-xs text-fg-3">{t.type_detection}</span>
                {manager && (
                  <span className="relative z-10 ml-auto">
                    <Menu label={`Actions pour ${t.code}`} trigger={<button aria-label={`Actions pour ${t.code}`} className="grid size-7 place-items-center rounded text-fg-3 opacity-0 hover:bg-panel-2 hover:text-fg focus-visible:opacity-100 group-hover/card:opacity-100"><MoreHorizontal className="size-4" /></button>}
                      items={[{ label: "Dupliquer", icon: <Copy className="size-4" />, onSelect: () => duplicate(t) }, "separator", { label: "Supprimer", icon: <Trash2 className="size-4" />, danger: true, onSelect: () => remove(t) }]} />
                  </span>
                )}
              </div>
              <h2 className="line-clamp-3 text-[15px] font-medium leading-snug">{t.cas_usage}</h2>
              <p className="truncate text-xs text-fg-3">{t.domaine}</p>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line-soft pt-3">
              <span className="flex items-center gap-1">
                {(siems.data ?? []).filter((s) => t.siems_regle.includes(s.code)).slice(0, 5).map((s) => <SiemMark key={s.code} code={s.code} nom={s.nom} size={20} />)}
                {t.siems_regle.length > 5 && <span className="text-xs text-fg-3">+{t.siems_regle.length - 5}</span>}
                {!t.siems_regle.length && <span className="text-xs text-fg-3">Aucune règle</span>}
              </span>
              <span className="flex items-center gap-2 text-fg-3">
                <Tip label={t.a_exclusions ? "Exclusions renseignées" : "Pas d'exclusions"}><ShieldOff className={cn("size-3.5", t.a_exclusions ? "text-st-a_revoir" : "opacity-30")} /></Tip>
                <Tip label={t.a_recommandation ? "Recommandation renseignée" : "Pas de recommandation"}><Lightbulb className={cn("size-3.5", t.a_recommandation ? "text-st-en_test" : "opacity-30")} /></Tip>
                <Tip label={t.a_impact ? "Impact renseigné" : "Pas d'impact"}><Flame className={cn("size-3.5", t.a_impact ? "text-[color:var(--sev-critique)]" : "opacity-30")} /></Tip>
                {manager && t.nb_clients !== undefined && <span className="text-xs" title="Clients qui l'utilisent">{t.nb_clients} client{t.nb_clients > 1 ? "s" : ""}</span>}
              </span>
            </div>
          </article>
        ))}
      </div>
      {manager && <NewTemplate open={creating} onOpenChange={setCreating} />}
    </>
  );
}

export default function Page() { return <Suspense fallback={<Loading loading />}><Library /></Suspense>; }
