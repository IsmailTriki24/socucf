"use client";
import { Suspense, use, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { LayoutGrid, Columns3, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { get, patch, post } from "@/lib/api";
import { errMsg, useAsync, useStored } from "@/lib/hooks";
import { GRAVITES, STATUTS, STATUT_LABEL, TYPES, graviteColor, statutColor, type StatutId } from "@/lib/status";
import { cn } from "@/lib/cn";
import type { DetectionItem, Tactique } from "@/lib/types";
import { Button, EmptyState, IconButton, Input, Loading, Notice, Segmented, Skeleton } from "@/components/ui/basics";
import { Menu, useConfirm } from "@/components/ui/overlay";
import { MultiFilter } from "@/components/detections/Filters";
import { CardBody, DraggableCard } from "@/components/detections/Card";
import AddDialog from "@/components/detections/AddDialog";
import ClientHeader from "@/components/domain/ClientHeader";
import { useClient } from "../ClientProvider";

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

function Column({ statut, items, children }: { statut: StatutId; items: DetectionItem[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: statut });
  const c = statutColor(statut);
  const s = STATUTS.find((x) => x.id === statut)!;
  return (
    <section ref={setNodeRef} aria-label={`${s.label}, ${items.length} détection(s)`} className={cn("flex min-h-[260px] min-w-0 flex-col overflow-hidden rounded-xl border bg-bg-2/60 transition-colors", isOver ? "border-[color:var(--c)] bg-panel-2" : "border-line-soft")} style={{ ["--c" as string]: c }}>
      <header className="flex items-center gap-2 px-3.5 pb-2 pt-3">
        <span className="size-2.5 rounded-full" style={{ background: c }} />
        <h2 className="text-[14px] font-semibold">{s.label}</h2>
        <span className="mono rounded bg-panel-3 px-1.5 text-xs text-fg-2">{items.length}</span>
      </header>
      <div className="scroll-thin grid max-h-[calc(100vh-330px)] min-h-[160px] min-w-0 flex-1 grid-cols-1 content-start gap-2 overflow-y-auto px-2.5 pb-3">
        {children}
        {items.length === 0 && <div className={cn("grid h-24 place-items-center rounded-lg border border-dashed text-[13px]", isOver ? "border-[color:var(--c)] text-fg" : "border-line text-fg-3")}>Déposez une détection ici</div>}
      </div>
    </section>
  );
}

function Page_({ id }: { id: string }) {
  const { client, can, reload: reloadClient } = useClient();
  const router = useRouter();
  const sp = useSearchParams();
  const confirm = useConfirm();
  const canEdit = can("detection.edit");
  const data = useAsync(() => get<DetectionItem[]>(`/clients/${id}/detections`), [id]);
  const tactiques = useAsync(() => get<Tactique[]>("/tactiques"), []);
  const [view, setView] = useStored<"board" | "grid">("socucf.vue", "board");
  const [items, setItems] = useState<DetectionItem[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [active, setActive] = useState<DetectionItem | null>(null);

  // La liste se synchronise sur la réponse du serveur ; les changements de statut sont appliqués tout de suite (optimiste).
  const [lastData, setLastData] = useState<DetectionItem[] | null>(null);
  if (data.data !== lastData) { setLastData(data.data); setItems(data.data); }

  const f = {
    q: sp.get("q") ?? "", statut: list(sp.get("statut")), domaine: list(sp.get("domaine")), gravite: list(sp.get("gravite")),
    type: list(sp.get("type")), tactique: list(sp.get("tactique")), regle: sp.get("regle") ?? "", journalisation: sp.get("journalisation") ?? "",
  };
  const setF = useCallback((patchF: Partial<Record<keyof typeof f, string | string[]>>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patchF)) {
      const s = Array.isArray(v) ? v.join(",") : (v ?? "");
      if (s) n.set(k, s); else n.delete(k);
    }
    router.replace(`/clients/${id}/detections${n.toString() ? "?" + n : ""}`, { scroll: false });
  }, [sp, router, id]);

  const filtered = useMemo(() => (items ?? []).filter((d) =>
    (!f.q || `${d.code} ${d.cas_usage} ${d.techniques.join(" ")}`.toLowerCase().includes(f.q.toLowerCase())) &&
    (!f.statut.length || f.statut.includes(d.statut)) && (!f.domaine.length || f.domaine.includes(String(d.domaine_id))) &&
    (!f.gravite.length || f.gravite.includes(d.gravite)) && (!f.type.length || f.type.includes(d.type_detection)) &&
    (!f.tactique.length || d.tactiques.some((t) => f.tactique.includes(t))) &&
    (!f.journalisation || d.journalisation === f.journalisation) &&
    (!f.regle || (f.regle === "avec" ? d.siems_regle.length > 0 : d.siems_regle.length === 0)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [items, sp.toString()]);

  const count = (fn: (d: DetectionItem) => string) => { const m: Record<string, number> = {}; (items ?? []).forEach((d) => { const k = fn(d); m[k] = (m[k] ?? 0) + 1; }); return m; };
  const nDom = count((d) => String(d.domaine_id)), nGr = count((d) => d.gravite), nTy = count((d) => d.type_detection), nSt = count((d) => d.statut);
  const domaines = useMemo(() => { const m = new Map<number, string>(); (items ?? []).forEach((d) => m.set(d.domaine_id, d.domaine)); return [...m].sort((a, b) => a[1].localeCompare(b[1])); }, [items]);
  const tacs = useMemo(() => { const present = new Set((items ?? []).flatMap((d) => d.tactiques)); return (tactiques.data ?? []).filter((t) => present.has(t.shortname)); }, [items, tactiques.data]);
  const nTac = useMemo(() => { const m: Record<string, number> = {}; (items ?? []).forEach((d) => d.tactiques.forEach((t) => (m[t] = (m[t] ?? 0) + 1))); return m; }, [items]);
  const filtering = !!(f.q || f.statut.length || f.domaine.length || f.gravite.length || f.type.length || f.tactique.length || f.regle || f.journalisation);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  async function changeStatut(ids: number[], statut: string, announce = true) {
    const before = items;
    setItems((cur) => cur && cur.map((d) => (ids.includes(d.id) ? { ...d, statut: statut as StatutId } : d)));
    try {
      if (ids.length === 1) await patch(`/detections/${ids[0]}`, { statut }); else await post(`/clients/${id}/detections/groupe`, { ids, action: "statut", valeur: statut });
      reloadClient();
      if (announce) {
        const prev = before!.filter((d) => ids.includes(d.id));
        toast(`${ids.length === 1 ? prev[0].code : ids.length + " détections"} : ${STATUT_LABEL[statut]}`, {
          action: { label: "Annuler", onClick: async () => { for (const p of prev) await patch(`/detections/${p.id}`, { statut: p.statut }); data.reload(); reloadClient(); } },
        });
      }
    } catch (e) { setItems(before); toast.error(errMsg(e)); }
  }
  async function changeJournal(ids: number[], valeur: "ok" | "non") {
    const before = items;
    setItems((cur) => cur && cur.map((d) => (ids.includes(d.id) ? { ...d, journalisation: valeur } : d)));
    try {
      if (ids.length === 1) await patch(`/detections/${ids[0]}`, { journalisation: valeur }); else await post(`/clients/${id}/detections/groupe`, { ids, action: "journalisation", valeur });
      reloadClient();
    } catch (e) { setItems(before); toast.error(errMsg(e)); }
  }
  async function remove(ids: number[]) {
    const codes = (items ?? []).filter((d) => ids.includes(d.id)).map((d) => d.code);
    const ok = await confirm({ title: ids.length === 1 ? `Supprimer ${codes[0]} ?` : `Supprimer ${ids.length} détections ?`, description: "Elles disparaissent de ce client (règles, tests et notes compris). Le template de la bibliothèque reste intact et pourra être réajouté.", confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    try {
      await post(`/clients/${id}/detections/groupe`, { ids, action: "supprimer" });
      setSelected(new Set()); toast.success(`${ids.length} détection(s) supprimée(s).`); data.reload(); reloadClient();
    } catch (e) { toast.error(errMsg(e)); }
  }

  const onDragStart = (e: DragStartEvent) => setActive((items ?? []).find((d) => String(d.id) === String(e.active.id)) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const d = (items ?? []).find((x) => String(x.id) === String(e.active.id));
    const to = e.over?.id as StatutId | undefined;
    if (!d || !to || !STATUTS.some((s) => s.id === to) || d.statut === to) return;
    changeStatut(selected.has(d.id) && selected.size > 1 ? [...selected] : [d.id], to);
  };

  const cardProps = (d: DetectionItem) => ({
    item: d, siems: client.siems, selected: selected.has(d.id), anySelected: selected.size > 0, canEdit,
    onOpen: () => router.push(`/clients/${id}/detections/${d.id}`),
    onSelect: () => setSelected((s) => { const n = new Set(s); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; }),
    onStatut: (s: string) => changeStatut([d.id], s), onJournal: (v: "ok" | "non") => changeJournal([d.id], v), onDelete: () => remove([d.id]),
  });
  const columns = f.statut.length ? STATUTS.filter((s) => f.statut.includes(s.id)) : STATUTS;

  return (
    <>
      <ClientHeader client={client} onPick={(s) => setF({ statut: f.statut.includes(s) ? f.statut.filter((x) => x !== s) : [...f.statut, s] })} />
      <div className="bleed top-0 z-20 mb-5 lg:sticky border-y border-line-soft bg-bg/90 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 max-w-xs flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-fg-3" /><Input className="pl-9" placeholder="Chercher code, cas d'usage, technique…" value={f.q} onChange={(e) => setF({ q: e.target.value })} aria-label="Chercher une détection" /></div>
          <MultiFilter label="Domaine" searchable value={f.domaine} onChange={(v) => setF({ domaine: v })} options={domaines.map(([i, n]) => ({ value: String(i), label: n, count: nDom[String(i)] }))} />
          <MultiFilter label="Gravité" value={f.gravite} onChange={(v) => setF({ gravite: v })} options={GRAVITES.map((g) => ({ value: g, label: g, count: nGr[g] ?? 0, color: graviteColor(g) }))} />
          <MultiFilter label="Type" value={f.type} onChange={(v) => setF({ type: v })} options={TYPES.map((g) => ({ value: g, label: g, count: nTy[g] ?? 0 }))} />
          <MultiFilter label="Statut" value={f.statut} onChange={(v) => setF({ statut: v })} options={STATUTS.map((s) => ({ value: s.id, label: s.label, count: nSt[s.id] ?? 0, color: statutColor(s.id) }))} />
          <MultiFilter label="Tactique ATT&CK" searchable value={f.tactique} onChange={(v) => setF({ tactique: v })} options={tacs.map((t) => ({ value: t.shortname, label: t.nom, count: nTac[t.shortname] }))} />
          <Segmented label="Journalisation" size="sm" value={(f.journalisation || "tous") as "tous" | "ok" | "non"} onChange={(v) => setF({ journalisation: v === "tous" ? "" : v })}
            options={[{ value: "tous", label: "Tous les logs" }, { value: "ok", label: "OK", color: "var(--ok)" }, { value: "non", label: "Non", color: "var(--err)" }]} />
          <Segmented label="Règle" size="sm" value={(f.regle || "toutes") as "toutes" | "avec" | "sans"} onChange={(v) => setF({ regle: v === "toutes" ? "" : v })}
            options={[{ value: "toutes", label: "Toutes" }, { value: "avec", label: "Avec règle" }, { value: "sans", label: "Sans règle" }]} />
          {filtering && <Button variant="ghost" size="sm" icon={<X className="size-3.5" />} onClick={() => router.replace(`/clients/${id}/detections`, { scroll: false })}>Effacer</Button>}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[13px] text-fg-3">{filtered.length}{filtering ? ` sur ${items?.length ?? 0}` : ""}</span>
            <Segmented label="Affichage" size="sm" value={view} onChange={setView} options={[{ value: "board", label: <><Columns3 className="size-3.5" />Tableau</> }, { value: "grid", label: <><LayoutGrid className="size-3.5" />Cartes</> }]} />
            {canEdit && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Ajouter</Button>}
          </div>
        </div>
      </div>

      <Loading error={data.error} onRetry={data.reload} />
      {data.loading && !items && <div className="grid gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>}
      {items && items.length === 0 && (
        <EmptyState title="Ce client n'a pas encore de détection" action={canEdit ? <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Ajouter des détections</Button> : undefined}>
          Copiez des templates de la bibliothèque ou créez une détection propre à ce client.
        </EmptyState>
      )}
      {items && items.length > 0 && filtered.length === 0 && (
        <EmptyState icon={<Search className="size-5" />} title="Aucune détection ne correspond" action={<Button onClick={() => router.replace(`/clients/${id}/detections`, { scroll: false })}>Effacer les filtres</Button>}>Essayez avec moins de filtres.</EmptyState>
      )}

      {items && filtered.length > 0 && view === "board" && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
          <div className="grid gap-3 overflow-x-auto pb-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(268px, 1fr))` }}>
            {columns.map((s) => {
              const col = filtered.filter((d) => d.statut === s.id);
              return <Column key={s.id} statut={s.id} items={col}>{col.map((d) => <DraggableCard key={d.id} {...cardProps(d)} />)}</Column>;
            })}
          </div>
          <DragOverlay dropAnimation={null}>{active && <div className="w-[268px] rotate-1 shadow-2xl"><CardBody {...cardProps(active)} /></div>}</DragOverlay>
        </DndContext>
      )}
      {items && filtered.length > 0 && view === "grid" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filtered.map((d) => <CardBody key={d.id} {...cardProps(d)} variant="rich" />)}</div>
      )}

      {selected.size > 0 && (
        <div className="anim-pop fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 shadow-[var(--shadow-pop)]" role="toolbar" aria-label="Actions groupées">
          <span className="px-2 text-[14px] font-medium">{selected.size} sélectionnée{selected.size > 1 ? "s" : ""}</span>
          <Menu align="start" trigger={<Button>Statut</Button>} items={STATUTS.map((s) => ({ label: s.label, icon: <span className="size-2.5 rounded-full" style={{ background: statutColor(s.id) }} />, onSelect: () => { changeStatut([...selected], s.id); setSelected(new Set()); } }))} />
          <Menu align="start" trigger={<Button>Journalisation</Button>} items={[{ label: "OK", onSelect: () => { changeJournal([...selected], "ok"); setSelected(new Set()); } }, { label: "Non", onSelect: () => { changeJournal([...selected], "non"); setSelected(new Set()); } }]} />
          <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => remove([...selected])}>Supprimer</Button>
          <IconButton label="Annuler la sélection" onClick={() => setSelected(new Set())}><X className="size-4" /></IconButton>
        </div>
      )}
      {canEdit && <AddDialog clientId={client.id} open={adding} onOpenChange={setAdding} onDone={() => { data.reload(); reloadClient(); }} />}
      {!canEdit && items && items.length > 0 && <Notice kind="info" className="mt-4">Lecture seule : votre rôle ne permet pas de modifier les détections de ce client.</Notice>}
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense fallback={<Loading loading />}><Page_ id={id} /></Suspense>;
}
