"use client";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookMarked, FileDown, LayoutDashboard, Moon, Plus, Radar, ShieldCheck, Target, Users } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { get } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import type { DetectionItem, TemplateItem } from "@/lib/types";
import { StatusPill, SeverityBars } from "./domain/marks";
import { useTheme } from "@/lib/theme";

export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { me } = useAuth();
  const { current, clients } = useWorkspace();
  const { toggle } = useTheme();
  const [dets, setDets] = useState<DetectionItem[]>([]);
  const [tpls, setTpls] = useState<TemplateItem[]>([]);

  useEffect(() => {
    if (!open) return;
    if (current) get<DetectionItem[]>(`/clients/${current.id}/detections`).then(setDets).catch(() => setDets([]));
    get<TemplateItem[]>("/templates").then(setTpls).catch(() => setTpls([]));
  }, [open, current]);

  const go = (href: string) => { onOpenChange(false); router.push(href); };
  const base = current ? `/clients/${current.id}` : "";
  const item = "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[14px] text-fg-2 data-[selected=true]:bg-panel-2 data-[selected=true]:text-fg";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content aria-describedby={undefined} className="anim-pop fixed left-1/2 top-[12vh] z-[80] w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl bg-panel shadow-[var(--shadow-pop)]">
          <Dialog.Title className="sr-only">Palette de commandes</Dialog.Title>
          <Command label="Palette de commandes" loop>
            <Command.Input autoFocus placeholder="Chercher DET-001, « force brute », une page…" className="h-14 w-full border-b border-line-soft bg-transparent px-5 text-[15px] outline-none placeholder:text-fg-3" />
            <Command.List className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
              <Command.Empty className="px-4 py-8 text-center text-fg-3">Aucun résultat.</Command.Empty>
              <Command.Group heading="Aller à" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3">
                {current && <>
                  <Command.Item className={item} onSelect={() => go(base)} keywords={["aperçu", "tableau de bord"]}><LayoutDashboard className="size-4" />Aperçu de {current.nom}</Command.Item>
                  <Command.Item className={item} onSelect={() => go(`${base}/detections`)}><ShieldCheck className="size-4" />Détections de {current.nom}</Command.Item>
                  <Command.Item className={item} onSelect={() => go(`${base}/couverture`)} keywords={["mitre", "matrice"]}><Target className="size-4" />Couverture ATT&CK de {current.nom}</Command.Item>
                  <Command.Item className={item} onSelect={() => go(`${base}/exports`)}><FileDown className="size-4" />Exports</Command.Item>
                </>}
                <Command.Item className={item} onSelect={() => go("/templates")}><BookMarked className="size-4" />Templates de la bibliothèque</Command.Item>
                <Command.Item className={item} onSelect={() => go("/mitre")} keywords={["mitre"]}><Radar className="size-4" />Couverture de la bibliothèque</Command.Item>
                {me?.is_platform_admin && <Command.Item className={item} onSelect={() => go("/clients/nouveau")} keywords={["créer", "ajouter"]}><Plus className="size-4" />Nouveau client</Command.Item>}
                {(me?.is_platform_admin || me?.habilitations.some((h) => h.role === "admin_client")) && <Command.Item className={item} onSelect={() => go("/acces")}><Users className="size-4" />Utilisateurs et accès</Command.Item>}
                <Command.Item className={item} onSelect={() => { onOpenChange(false); toggle(); }} keywords={["thème", "sombre", "clair"]}><Moon className="size-4" />Changer de thème</Command.Item>
              </Command.Group>
              {(clients?.length ?? 0) > 1 && (
                <Command.Group heading="Clients" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3">
                  {clients?.map((c) => <Command.Item key={c.id} value={`client ${c.nom}`} className={item} onSelect={() => go(`/clients/${c.id}`)}>{c.nom}</Command.Item>)}
                </Command.Group>
              )}
              {dets.length > 0 && (
                <Command.Group heading={`Détections de ${current?.nom}`} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3">
                  {dets.map((d) => (
                    <Command.Item key={d.id} value={`${d.code} ${d.cas_usage} ${d.domaine}`} className={item} onSelect={() => go(`${base}/detections/${d.id}`)}>
                      <span className="mono w-16 shrink-0 text-xs text-fg-3">{d.code}</span><span className="min-w-0 flex-1 truncate">{d.cas_usage}</span><SeverityBars gravite={d.gravite} /><StatusPill statut={d.statut} size="sm" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {tpls.length > 0 && (
                <Command.Group heading="Templates" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3">
                  {tpls.map((t) => (
                    <Command.Item key={t.code} value={`template ${t.code} ${t.cas_usage}`} className={item} onSelect={() => go(`/templates/${t.code}`)}>
                      <span className="mono w-16 shrink-0 text-xs text-fg-3">{t.code}</span><span className="min-w-0 flex-1 truncate">{t.cas_usage}</span><SeverityBars gravite={t.gravite} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
