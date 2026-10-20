"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(q.matches);
    on(); q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return wide;
}

import {
  Activity, BookMarked, ChevronsUpDown, FileDown, History, LayoutDashboard, Library, Lock, LogOut, Moon, PanelLeftClose, PanelLeftOpen,
  Menu as MenuIcon, Plus, Search, Settings2, ShieldCheck, Sun, Target, Upload, Users, Radar, Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { useStored } from "@/lib/hooks";
import { ROLE_LABELS } from "@/lib/status";
import { cn } from "@/lib/cn";
import { hue, plural } from "@/lib/format";
import { Avatar, IconButton, Kbd, Spinner } from "./ui/basics";
import { Menu, Pop, Tip } from "./ui/overlay";
import { ClientMark } from "./domain/marks";
import CommandPalette from "./CommandPalette";
import { useTheme } from "@/lib/theme";

const PUBLIC = ["/login"];

type Item = { href: string; label: string; icon: React.ReactNode; show?: boolean; exact?: boolean };

function NavLink({ item, collapsed, locked, path }: { item: Item; collapsed: boolean; locked: boolean; path: string }) {
  const active = item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/");
  const body = (
    <span className={cn("group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-[14px] transition-colors",
      locked ? "cursor-not-allowed text-fg-3/60" : active ? "bg-panel-2 font-medium text-fg" : "text-fg-2 hover:bg-panel-2/70 hover:text-fg")}>
      {active && !locked && <span className="absolute -left-2 top-1.5 h-6 w-[3px] rounded-full" style={{ background: "hsl(var(--client-h) 85% 65%)" }} />}
      <span className="grid size-5 shrink-0 place-items-center">{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && locked && <Lock className="ml-auto size-3.5" />}
    </span>
  );
  if (locked) return <Tip label="Créez d'abord un client" side="right"><div aria-disabled>{body}</div></Tip>;
  return collapsed ? <Tip label={item.label} side="right"><Link href={item.href} aria-label={item.label}>{body}</Link></Tip> : <Link href={item.href}>{body}</Link>;
}

function Group({ title, items, collapsed, locked, path }: { title: string; items: Item[]; collapsed: boolean; locked: boolean; path: string }) {
  const shown = items.filter((i) => i.show !== false);
  if (!shown.length) return null;
  return (
    <div className="grid gap-0.5">
      {collapsed ? <div className="mx-2 my-2 h-px bg-line-soft" /> : <div className="px-2.5 pb-1 pt-4 text-xs font-medium text-fg-3">{title}</div>}
      {shown.map((i) => <NavLink key={i.href} item={i} collapsed={collapsed} locked={locked} path={path} />)}
    </div>
  );
}

function ClientSwitcher({ collapsed, locked }: { collapsed: boolean; locked: boolean }) {
  const { clients, current } = useWorkspace();
  const { me } = useAuth();
  const router = useRouter();
  if (locked || !current) {
    return (
      <div className={cn("flex items-center gap-3 rounded-lg border border-dashed border-line px-3 py-2.5 text-fg-3", collapsed && "justify-center px-0")}>
        <Lock className="size-4" />{!collapsed && <span className="text-[13px]">Aucun client</span>}
      </div>
    );
  }
  return (
    <Pop width={288} align="start" trigger={
      <button className={cn("flex w-full items-center gap-3 rounded-lg border border-line bg-panel-2/60 px-2.5 py-2 text-left transition-colors hover:border-accent/50", collapsed && "justify-center px-1.5")} aria-label="Changer de client">
        <ClientMark nom={current.nom} size={30} />
        {!collapsed && (<>
          <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold leading-tight">{current.nom}</span><span className="block truncate text-xs text-fg-3">{plural(current.nb_detections ?? 0, "détection")}</span></span>
          <ChevronsUpDown className="size-4 shrink-0 text-fg-3" />
        </>)}
      </button>}>
      {(close) => (
        <div className="grid gap-0.5">
          <div className="px-2 pb-1 pt-1 text-xs font-medium text-fg-3">Clients</div>
          <div className="max-h-72 overflow-y-auto">
            {clients?.map((c) => (
              <button key={c.id} onClick={() => { close(); router.push(`/clients/${c.id}`); }} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-panel-2">
                <ClientMark nom={c.nom} size={26} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px]">{c.nom}</span><span className="block truncate text-xs text-fg-3">{c.siems.map((s) => s.nom).join(", ")}</span></span>
                {c.id === current.id && <Check className="size-4 text-accent" />}
              </button>
            ))}
          </div>
          <div className="my-1 h-px bg-line-soft" />
          <button onClick={() => { close(); router.push("/clients"); }} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13.5px] hover:bg-panel-2"><Library className="size-4 text-fg-3" />Tous les clients</button>
          {me?.is_platform_admin && <button onClick={() => { close(); router.push("/clients/nouveau"); }} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13.5px] text-accent hover:bg-panel-2"><Plus className="size-4" />Nouveau client</button>}
        </div>
      )}
    </Pop>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { me, loading, logout } = useAuth();
  const { clients, current } = useWorkspace();
  const path = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useStored<boolean>("socusf.rail", false);
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const wide = useWide();
  useEffect(() => setDrawer(false), [path]);
  const isPublic = PUBLIC.some((p) => path.startsWith(p));
  const noClient = clients !== null && clients.length === 0;

  useEffect(() => {
    if (!loading && !me && !isPublic) router.replace("/login");
  }, [loading, me, isPublic, router]);

  // Passage obligé : sans client, tout renvoie vers la création du premier client.
  useEffect(() => {
    if (!me || clients === null) return;
    if (noClient && !path.startsWith("/bienvenue")) router.replace("/bienvenue");
    if (!noClient && path.startsWith("/bienvenue")) router.replace("/");
  }, [me, clients, noClient, path, router]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--client-h", String(current ? hue(current.nom) : 224));
  }, [current]);

  if (isPublic) return <>{children}</>;
  if (loading || !me || clients === null) return <div className="grid h-screen place-items-center"><Spinner className="size-6" /></div>;

  const rail = collapsed && wide;
  const base = current ? `/clients/${current.id}` : "/bienvenue";
  const locked = noClient;
  const canAudit = !!current?.permissions["audit.view"];
  const role = me.is_platform_admin ? ROLE_LABELS.admin_plateforme : me.role_global ? ROLE_LABELS[me.role_global]
    : me.habilitations.length ? [...new Set(me.habilitations.map((h) => ROLE_LABELS[h.role]))].join(", ") : "Sans habilitation";
  const manageAccess = me.is_platform_admin || me.habilitations.some((h) => h.role === "admin_client");

  const workspace: Item[] = [
    { href: base, label: "Aperçu", icon: <LayoutDashboard className="size-[18px]" />, exact: true },
    { href: `${base}/detections`, label: "Détections", icon: <ShieldCheck className="size-[18px]" /> },
    { href: `${base}/couverture`, label: "Couverture ATT&CK", icon: <Target className="size-[18px]" /> },
    { href: `${base}/exports`, label: "Exports", icon: <FileDown className="size-[18px]" />, show: !current || current.permissions["export"] },
    { href: `${base}/audit`, label: "Journal du client", icon: <History className="size-[18px]" />, show: !current || canAudit },
    { href: `${base}/parametres`, label: "Paramètres", icon: <Settings2 className="size-[18px]" /> },
  ];
  const library: Item[] = [
    { href: "/templates", label: "Templates", icon: <BookMarked className="size-[18px]" /> },
    { href: "/mitre", label: "Couverture bibliothèque", icon: <Radar className="size-[18px]" /> },
    { href: "/referentiels", label: "Plateformes et sources", icon: <Activity className="size-[18px]" /> },
  ];
  const admin: Item[] = [
    { href: "/admin/import", label: "Imports", icon: <Upload className="size-[18px]" />, show: me.is_catalogue_manager },
    { href: "/acces", label: "Utilisateurs et accès", icon: <Users className="size-[18px]" />, show: manageAccess },
    { href: "/admin/audit", label: "Journal global", icon: <History className="size-[18px]" />, show: me.is_platform_admin },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {drawer && <button aria-label="Fermer le menu" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setDrawer(false)} />}
      <nav aria-label="Navigation principale" className={cn("fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-line-soft bg-bg-2 transition-[width,transform] duration-150 lg:static lg:translate-x-0", drawer ? "translate-x-0" : "-translate-x-full", rail ? "w-[68px]" : "w-[252px]")}>
        <div className={cn("flex h-14 items-center gap-2 px-3.5", rail && "justify-center px-0")}>
          <Link href="/" className="flex items-center gap-2.5" aria-label="SOC USF, accueil">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink"><Radar className="size-[18px]" strokeWidth={2.4} /></span>
            {!rail && <span className="text-[16px] font-bold tracking-tight">SOC USF</span>}
          </Link>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-3">
          <ClientSwitcher collapsed={rail} locked={locked} />
          <Group title="Espace client" items={workspace} collapsed={rail} locked={locked} path={path} />
          <Group title="Bibliothèque" items={library} collapsed={rail} locked={locked} path={path} />
          <Group title="Administration" items={admin} collapsed={rail} locked={locked} path={path} />
        </div>
        <div className="hidden border-t border-line-soft p-2.5 lg:block">
          <button onClick={() => setCollapsed(!collapsed)} className={cn("flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] text-fg-3 hover:bg-panel-2 hover:text-fg", collapsed && "justify-center")} aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" />Replier</>}
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line-soft bg-bg/80 px-4 backdrop-blur sm:px-6" style={{ boxShadow: "inset 0 -1px 0 hsl(var(--client-h) 70% 55% / .35)" }}>
          <IconButton label="Ouvrir le menu" className="lg:hidden" onClick={() => setDrawer(true)}><MenuIcon className="size-5" /></IconButton>
          <button onClick={() => !locked && setPalette(true)} disabled={locked}
            className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-md border border-line bg-panel/60 px-3 text-left text-fg-3 transition-colors hover:border-accent/50 disabled:opacity-50">
            <Search className="size-4" /><span className="flex-1 truncate text-[13.5px]">Chercher une détection, un template, une page…</span><span className="hidden sm:inline"><Kbd>Ctrl K</Kbd></span>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <IconButton label={theme === "dark" ? "Passer au thème Jour" : "Passer au thème Nuit"} onClick={toggle}>{theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}</IconButton>
            <Menu label="Menu utilisateur" trigger={<button className="flex items-center gap-2.5 rounded-md py-1 pl-1.5 pr-2.5 hover:bg-panel-2"><Avatar name={me.nom} size={30} /><span className="hidden text-left leading-tight sm:block"><span className="block text-[13.5px] font-medium">{me.nom}</span><span className="block text-xs text-fg-3">{role}</span></span></button>}
              items={[{ label: "Se déconnecter", icon: <LogOut className="size-4" />, onSelect: logout }]} />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto" id="contenu">
          <div className="mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-8 sm:py-7">{children}</div>
        </main>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
}
