"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { get, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { errMsg, useAsync } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import type { Domaine, Siem } from "@/lib/types";
import { Button, Field, Input, Loading, Notice } from "./ui/basics";
import { DomainPicker, PlatformPicker } from "./Pickers";
import { ClientMark, SiemMark } from "./domain/marks";

const STEPS = [
  { id: "client", title: "Le client", help: "Son nom et son secteur" },
  { id: "plateformes", title: "Plateformes SIEM / XDR", help: "Où ses règles seront déployées" },
  { id: "domaines", title: "Domaines", help: "Ce qu'il faut surveiller" },
  { id: "creer", title: "Vérifier et créer", help: "Les détections sont copiées pour lui" },
] as const;

const SECTEURS = ["Industrie", "Santé", "Finance", "Secteur public", "Énergie", "Commerce", "Services", "Éducation"];

export default function ClientWizard({ firstRun }: { firstRun?: boolean }) {
  const router = useRouter();
  const { me } = useAuth();
  const { reload, remember } = useWorkspace();
  const siems = useAsync(() => get<Siem[]>("/siems"), []);
  const domaines = useAsync(() => get<Domaine[]>("/domaines"), []);
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ nom: "", secteur: "", admin_username: "" });
  const [sel, setSel] = useState<string[]>([]);
  const [dom, setDom] = useState<number[] | null>(null);   // null = tous (coché par défaut), tant que l'utilisateur n'a rien changé
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const allDom = domaines.data ?? [];
  const chosen = dom ?? allDom.map((d) => d.id);
  const nbDetections = allDom.filter((d) => chosen.includes(d.id)).reduce((a, d) => a + (d.nb_templates ?? 0), 0);

  if (me && !me.is_platform_admin) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-panel-2 text-fg-3"><Lock className="size-6" /></div>
        <h1 className="text-2xl">Aucun client n&apos;est encore accessible</h1>
        <p className="mt-2 text-fg-3">Un client doit exister avant de pouvoir utiliser la plateforme. Demandez à un administrateur plateforme d&apos;en créer un, ou de vous donner accès à un client existant.</p>
      </div>
    );
  }

  const valid = [f.nom.trim().length > 0, sel.length > 0, chosen.length > 0, true];
  const next = () => valid[step] && setStep(step + 1);

  async function create() {
    setBusy(true); setErr(null);
    try {
      const c = await post<{ id: number; nom: string; nb_detections: number }>("/clients", { ...f, nom: f.nom.trim(), siems: sel, domaines: chosen });
      await reload();
      remember(c.id);
      toast.success(`${c.nom} créé : ${plural(c.nb_detections, "détection")} prête(s) à travailler.`);
      router.push(`/clients/${c.id}?bienvenue=1`);
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[320px_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        {firstRun ? (
          <div className="mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-[13px] font-medium text-warn"><Lock className="size-3.5" />Première étape obligatoire</span>
            <h1 className="mt-4 text-[34px] leading-[1.1]">Commençons par votre premier client</h1>
            <p className="mt-3 text-fg-3">Les détections, la journalisation et la couverture ATT&CK sont toujours rattachées à un client. Le reste de la plateforme se débloque dès qu&apos;il existe.</p>
          </div>
        ) : (
          <div className="mb-8"><h1 className="text-[28px] leading-tight">Nouveau client</h1><p className="mt-2 text-fg-3">Quatre étapes. Vous pourrez tout modifier ensuite dans les paramètres du client.</p></div>
        )}
        <ol className="grid gap-1" aria-label="Étapes">
          {STEPS.map((s, i) => {
            const done = i < step, cur = i === step;
            return (
              <li key={s.id}>
                <button type="button" disabled={i > step && !valid.slice(0, i).every(Boolean)} onClick={() => setStep(i)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors disabled:opacity-45", cur ? "bg-panel-2" : "hover:bg-panel-2/60")}>
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-[13px] font-semibold", done ? "border-ok bg-ok/15 text-ok" : cur ? "border-accent bg-accent text-accent-ink" : "border-line text-fg-3")}>
                    {done ? <Check className="size-3.5" strokeWidth={3.5} /> : i + 1}
                  </span>
                  <span><span className={cn("block text-[14px] font-medium", !cur && !done && "text-fg-2")}>{s.title}</span><span className="block text-xs text-fg-3">{s.help}</span></span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[[sel.length, "plateformes"], [chosen.length, "domaines"], [nbDetections, "détections"]].map(([n, l]) => (
            <div key={l as string} className="surface-2 px-2 py-2.5"><div className="text-[22px] font-bold leading-none">{n}</div><div className="mt-1 text-xs text-fg-3">{l}</div></div>
          ))}
        </div>
      </aside>

      <section className="surface min-h-[520px] p-7">
        {err && <Notice kind="err" className="mb-5">{err}</Notice>}

        {step === 0 && (
          <div className="grid max-w-xl gap-6">
            <div><h2 className="text-xl">Comment s&apos;appelle le client ?</h2><p className="mt-1 text-fg-3">Le nom apparaît dans le sélecteur de client et dans les exports.</p></div>
            <Field label="Nom du client"><Input autoFocus value={f.nom} placeholder="Ex. Banque Atlas" onChange={(e) => setF({ ...f, nom: e.target.value })} onKeyDown={(e) => e.key === "Enter" && next()} maxLength={200} className="h-11 text-[16px]" /></Field>
            <Field label="Secteur d'activité" group hint="Facultatif">
              <Input value={f.secteur} onChange={(e) => setF({ ...f, secteur: e.target.value })} maxLength={100} placeholder="Choisissez ou saisissez" />
              <div className="flex flex-wrap gap-1.5">{SECTEURS.map((s) => <button key={s} type="button" onClick={() => setF({ ...f, secteur: s })} className={cn("rounded-full border px-2.5 py-0.5 text-[13px] transition-colors", f.secteur === s ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-2 hover:border-accent/50")}>{s}</button>)}</div>
            </Field>
            <Field label="Admin du client" hint="Facultatif : identifiant d'un utilisateur existant qui gérera les accès de ce client."><Input value={f.admin_username} onChange={(e) => setF({ ...f, admin_username: e.target.value })} placeholder="identifiant" autoComplete="off" /></Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5">
            <div><h2 className="text-xl">Quelles plateformes le client utilise-t-il ?</h2><p className="mt-1 max-w-xl text-fg-3">SIEM, XDR ou format générique : les règles sont préparées pour chacune. Choisissez-en une ou plusieurs.</p></div>
            <Loading error={siems.error} loading={siems.loading && !siems.data} />
            <PlatformPicker siems={siems.data ?? []} value={sel} onChange={setSel} onCreated={siems.reload} />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5">
            <div><h2 className="text-xl">Quels domaines surveiller ?</h2><p className="mt-1 max-w-xl text-fg-3">Tous sont cochés : décochez ce qui ne concerne pas ce client. Vous pourrez en ajouter plus tard.</p></div>
            <Loading error={domaines.error} loading={domaines.loading && !domaines.data} />
            <DomainPicker domaines={allDom} value={chosen} onChange={setDom} />
          </div>
        )}

        {step === 3 && (
          <div className="grid max-w-2xl gap-6">
            <div><h2 className="text-xl">Tout est prêt</h2><p className="mt-1 text-fg-3">À la création, chaque template des domaines choisis est copié chez le client en « Brouillon », avec les règles de ses plateformes. Tout reste modifiable.</p></div>
            <div className="surface-2 grid gap-4 p-5">
              <div className="flex items-center gap-3"><ClientMark nom={f.nom || "?"} size={44} /><div><div className="text-lg font-semibold">{f.nom}</div><div className="text-fg-3">{f.secteur || "Secteur non renseigné"}</div></div></div>
              <div><div className="mb-1.5 text-[13px] text-fg-3">Plateformes</div><div className="flex flex-wrap gap-2">{sel.map((c) => { const s = siems.data?.find((x) => x.code === c); return s && <span key={c} className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-1 text-[13px]"><SiemMark code={s.code} nom={s.nom} size={18} />{s.nom}</span>; })}</div></div>
              <div><div className="mb-1.5 text-[13px] text-fg-3">{plural(chosen.length, "domaine")} sur {allDom.length}</div><div className="flex flex-wrap gap-1.5">{allDom.filter((d) => chosen.includes(d.id)).map((d) => <span key={d.id} className="rounded-md bg-panel px-2 py-0.5 text-[13px] text-fg-2">{d.nom}</span>)}</div></div>
            </div>
            <Notice kind="info"><span className="inline-flex items-center gap-2"><ShieldCheck className="size-4" /><b>{plural(nbDetections, "détection")}</b> seront créées pour ce client.</span></Notice>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-line-soft pt-5">
          <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)} icon={<ChevronLeft className="size-4" />}>Retour</Button>
          {step < 3 ? (
            <Button variant="primary" size="lg" disabled={!valid[step]} onClick={next}>Continuer<ChevronRight className="size-4" /></Button>
          ) : (
            <Button variant="primary" size="lg" loading={busy} onClick={create}>{busy ? "Création en cours…" : `Créer le client et ses ${nbDetections} détections`}</Button>
          )}
        </div>
      </section>
    </div>
  );
}
