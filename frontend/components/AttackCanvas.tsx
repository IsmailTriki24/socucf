"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, MiniMap, type ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import { ExternalLink, Expand, Locate, Maximize2, Minimize2, Minus, Plus, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { STATUT_LABEL, statutColor } from "@/lib/status";
import type { MatrixCell, MatrixData } from "@/lib/types";
import { Chip, IconButton, Input, Notice, Segmented } from "./ui/basics";
import { Drawer, Tip } from "./ui/overlay";

type Mode = "count" | "statut";

function cellStyle(c: MatrixCell, mode: Mode, max: number): React.CSSProperties {
  if (!c.count) return {};
  if (mode === "statut") {
    const col = statutColor(c.statut ?? "brouillon");
    return { background: `color-mix(in srgb, ${col} 24%, var(--panel))`, borderColor: `color-mix(in srgb, ${col} 70%, transparent)`, boxShadow: `inset 3px 0 0 ${col}` };
  }
  const level = Math.max(1, Math.ceil((c.count / Math.max(max, 1)) * 4));
  const pct = [0, 22, 42, 62, 84][level];
  return { background: `color-mix(in srgb, var(--accent) ${pct}%, var(--panel))`, borderColor: `color-mix(in srgb, var(--accent) ${Math.min(pct + 25, 100)}%, transparent)`, color: level >= 3 ? "var(--accent-ink)" : undefined };
}

function Toolbar({ scale, fullscreen, onFullscreen, apiRef }: { scale: number; fullscreen: boolean; onFullscreen: () => void; apiRef: React.RefObject<ReactZoomPanPinchContentRef | null> }) {
  const a = () => apiRef.current;
  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-panel/95 p-1 shadow-lg backdrop-blur" role="toolbar" aria-label="Zoom de la matrice">
      <IconButton label="Dézoomer" size="sm" onClick={() => a()?.zoomOut(0.25)}><Minus className="size-4" /></IconButton>
      <span className="mono w-12 text-center text-xs text-fg-2" aria-live="polite">{Math.round(scale * 100)}%</span>
      <IconButton label="Zoomer" size="sm" onClick={() => a()?.zoomIn(0.25)}><Plus className="size-4" /></IconButton>
      <span className="mx-1 h-5 w-px bg-line" />
      <Tip label="Tout voir"><IconButton label="Ajuster à la fenêtre" size="sm" onClick={() => a()?.fitToView({ minScale: 0.1, animationTime: 250 })}><Expand className="size-4" /></IconButton></Tip>
      <Tip label="Zoom 100 %"><IconButton label="Zoom à 100 %" size="sm" onClick={() => a()?.setTransform(16, 16, 1, 250)}><Locate className="size-4" /></IconButton></Tip>
      <IconButton label={fullscreen ? "Quitter le plein écran" : "Plein écran"} size="sm" onClick={onFullscreen}>{fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</IconButton>
    </div>
  );
}

/** Matrice MITRE ATT&CK dans un cadre zoomable : molette ou boutons pour zoomer, glisser pour se déplacer, clic pour le détail. */
export default function AttackCanvas({ data, defaultMode = "count", detectionHref, scope = "bibliothèque" }: { data: MatrixData; defaultMode?: Mode; detectionHref?: (code: string) => string | null; scope?: string }) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [scale, setScale] = useState(0.62);
  const [full, setFull] = useState(false);
  const [sel, setSel] = useState<MatrixCell | null>(null);
  const [q, setQ] = useState("");
  const apiRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const max = useMemo(() => Math.max(1, ...data.tactiques.flatMap((t) => t.techniques.map((c) => c.count))), [data]);
  const cols = data.tactiques.filter((t) => t.techniques.length);
  const needle = q.trim().toLowerCase();
  const match = (c: MatrixCell) => !needle || `${c.id} ${c.nom} ${c.sous_techniques.map((s) => s.id + " " + s.nom).join(" ")}`.toLowerCase().includes(needle);
  const nbMatch = needle ? cols.reduce((a, t) => a + t.techniques.filter(match).length, 0) : 0;
  const covered = cols.reduce((a, t) => a + t.techniques.filter((c) => c.count).length, 0);
  const total = cols.reduce((a, t) => a + t.techniques.length, 0);

  const frame = (
    <div className={cn("relative overflow-hidden rounded-xl border border-line bg-bg-2", full ? "fixed inset-0 z-[60] rounded-none" : "h-[calc(100vh-290px)] min-h-[480px]")}
      style={{ backgroundImage: "radial-gradient(var(--line-soft) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
      <TransformWrapper ref={apiRef as React.Ref<ReactZoomPanPinchContentRef>} minScale={0.08} maxScale={2.5} initialScale={0.62} initialPositionX={16} initialPositionY={16} limitToBounds={false}
        wheel={{ step: 0.08 }} doubleClick={{ disabled: true }} panning={{ velocityDisabled: false }} keyboard={{ disabled: false }}
        onTransform={(_, s) => setScale(s.scale)}>
        <Toolbar scale={scale} fullscreen={full} onFullscreen={() => setFull(!full)} apiRef={apiRef} />
        <div className="absolute bottom-3 right-3 z-10 hidden overflow-hidden rounded-lg border border-line bg-panel/90 shadow-lg md:block" aria-hidden>
          <MiniMap width={180} borderColor="var(--line)">
            <div className="flex gap-1.5 p-4">{cols.map((t) => <div key={t.shortname} className="grid w-40 content-start gap-1">{t.techniques.map((c) => <div key={c.id} className="h-5 rounded-sm" style={c.count ? { background: cellStyle(c, mode, max).background as string } : { background: "var(--panel-3)" }} />)}</div>)}</div>
          </MiniMap>
        </div>
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div className="flex items-start gap-2 p-5" role="grid" aria-label="Matrice MITRE ATT&CK">
            {cols.map((t) => (
              <div key={t.shortname} className="grid w-44 shrink-0 content-start gap-1.5" role="rowgroup">
                <h3 className="sticky top-0 rounded-md bg-panel-3 px-2.5 py-2 text-[13px] font-semibold leading-tight">{t.nom}<span className="mono ml-1.5 font-normal text-fg-3">{t.techniques.filter((c) => c.count).length}/{t.techniques.length}</span></h3>
                {t.techniques.map((c) => {
                  const dim = needle && !match(c);
                  const subCov = c.sous_techniques.filter((s) => s.count).length;
                  return (
                    <button key={c.id} type="button" onClick={() => setSel(c)} title={`${c.id} ${c.nom}${c.count ? ` : ${c.detections.join(", ")}` : " : non couverte"}`}
                      className={cn("grid gap-0.5 rounded-md border px-2 py-1.5 text-left text-[12.5px] leading-tight transition-opacity", c.count ? "" : "border-line-soft bg-panel/70 text-fg-2", dim && "opacity-20", needle && !dim && "ring-2 ring-accent")}
                      style={cellStyle(c, mode, max)}>
                      <span className="flex items-center justify-between gap-1"><span className="mono text-[11px] opacity-75">{c.id}</span>{c.count > 0 && <span className="mono rounded bg-black/20 px-1 text-[11px] font-semibold">{c.count}</span>}</span>
                      <span className="line-clamp-2 font-medium">{c.nom}</span>
                      {c.sous_techniques.length > 0 && <span className="text-[10.5px] opacity-70">{subCov}/{c.sous_techniques.length} sous-technique{c.sous_techniques.length > 1 ? "s" : ""}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </TransformComponent>
      </TransformWrapper>
      {full && <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-panel/90 px-3 py-1 text-[13px] text-fg-2">Échap ou le bouton pour quitter le plein écran</div>}
    </div>
  );

  return (
    <div className="grid gap-3" onKeyDown={(e) => e.key === "Escape" && full && setFull(false)}>
      {!data.referentiel_charge && <Notice kind="warn">Référentiel ATT&CK non chargé : seules les techniques utilisées sont affichées, sans tactique. Chargez le bundle STIX dans Imports.</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-fg-3" /><Input className="pl-9" placeholder="Chercher une technique…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher une technique dans la matrice" /></div>
        {needle && <span className="text-[13px] text-fg-3">{nbMatch} technique(s)</span>}
        <Segmented label="Colorier par" size="sm" value={mode} onChange={setMode} options={[{ value: "count", label: "Nombre de détections" }, { value: "statut", label: "Statut le plus avancé" }]} />
        <span className="ml-auto text-[13px] text-fg-3"><b className="text-fg">{covered}</b> techniques couvertes sur {total} affichées</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-fg-3" aria-label="Légende">
        {mode === "count" ? (
          <><span>Peu</span><span className="flex overflow-hidden rounded">{[22, 42, 62, 84].map((p) => <span key={p} className="h-3 w-8" style={{ background: `color-mix(in srgb, var(--accent) ${p}%, var(--panel))` }} />)}</span><span>Beaucoup de détections</span><span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-line-soft bg-panel/70" />non couverte</span></>
        ) : (
          (["deployee", "validee", "a_revoir", "en_test", "brouillon"] as const).map((s) => <span key={s} className="flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: statutColor(s) }} />{STATUT_LABEL[s]}</span>)
        )}
        <span className="ml-auto hidden md:inline">Molette : zoom · Glisser : déplacer · Clic : détail</span>
      </div>
      {frame}
      <Drawer open={!!sel} onOpenChange={(o) => !o && setSel(null)} width={480}
        title={sel ? <><span className="mono mr-2 text-accent">{sel.id}</span>{sel.nom}</> : ""} subtitle={sel ? `${sel.count} détection(s) dans la ${scope}` : undefined}>
        {sel && (
          <div className="grid gap-6">
            <section>
              <h3 className="mb-2 text-[14px] font-semibold">Détections</h3>
              {sel.detections.length ? <ul className="flex flex-wrap gap-1.5">{sel.detections.map((d) => { const h = detectionHref?.(d); return <li key={d}>{h ? <Link href={h} className="mono block rounded-md border border-line bg-panel-2 px-2 py-1 text-[13px] hover:border-accent/60">{d}</Link> : <Chip className="mono">{d}</Chip>}</li>; })}</ul>
                : <p className="text-fg-3">Aucune détection ne couvre cette technique.</p>}
            </section>
            {sel.sous_techniques.length > 0 && (
              <section>
                <h3 className="mb-2 text-[14px] font-semibold">Sous-techniques</h3>
                <ul className="grid gap-1.5">
                  {sel.sous_techniques.map((s) => (
                    <li key={s.id} className="rounded-lg border border-line-soft px-3 py-2">
                      <div className="flex items-center gap-2"><span className="mono text-[12.5px] text-accent">{s.id}</span><span className="min-w-0 flex-1 truncate text-[13.5px]">{s.nom}</span>{s.statut && <span className="size-2.5 rounded-full" style={{ background: statutColor(s.statut) }} title={STATUT_LABEL[s.statut]} />}</div>
                      <div className="mt-1 flex flex-wrap gap-1">{s.detections.length ? s.detections.map((d) => { const h = detectionHref?.(d); return h ? <Link key={d} href={h} className="mono rounded bg-panel-3 px-1.5 text-xs hover:text-accent">{d}</Link> : <Chip key={d} className="mono">{d}</Chip>; }) : <span className="text-xs text-fg-3">non couverte</span>}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <a href={`https://attack.mitre.org/techniques/${sel.id.replace(".", "/")}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] text-accent hover:underline"><ExternalLink className="size-3.5" />Voir sur attack.mitre.org</a>
          </div>
        )}
      </Drawer>
    </div>
  );
}
