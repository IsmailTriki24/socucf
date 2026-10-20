"use client";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, IconButton, Input } from "./basics";

export function Modal({ open, onOpenChange, title, description, children, size = "md", footer }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl"; footer?: React.ReactNode;
}) {
  const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] animate-[fade-in_.12s]" />
        <Dialog.Content className={cn("anim-pop fixed left-1/2 top-[7vh] z-50 flex max-h-[86vh] w-[calc(100vw-24px)] -translate-x-1/2 flex-col rounded-xl bg-panel shadow-[var(--shadow-pop)]", w)}>
          <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
            <div>
              <Dialog.Title className="text-[17px] font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-[13px] text-fg-3">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close asChild><IconButton label="Fermer" size="sm"><X className="size-4" /></IconButton></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Panneau latéral : détail d'une technique, d'une détection en aperçu… */
export function Drawer({ open, onOpenChange, title, subtitle, children, width = 520 }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; width?: number;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-[fade-in_.12s]" />
        <Dialog.Content aria-describedby={undefined} style={{ width }} className="fixed bottom-0 right-0 top-0 z-50 flex max-w-full flex-col border-l border-line bg-panel shadow-[var(--shadow-pop)] animate-[slide-in-right_.18s_ease-out]">
          <div className="flex items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-[17px] font-semibold">{title}</Dialog.Title>
              {subtitle && <div className="mt-0.5 text-[13px] text-fg-3">{subtitle}</div>}
            </div>
            <Dialog.Close asChild><IconButton label="Fermer" size="sm"><X className="size-4" /></IconButton></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Tip({ label, children, side = "top" }: { label: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip.Root delayDuration={250}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={6} className="z-[70] max-w-xs rounded-md border border-line bg-panel-3 px-2.5 py-1.5 text-[12.5px] leading-snug text-fg shadow-lg animate-[fade-in_.1s]">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
export const TooltipProvider = Tooltip.Provider;

export type MenuItem = { label: string; icon?: React.ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string } | "separator";

export function Menu({ trigger, items, align = "end", label }: { trigger: React.ReactNode; items: MenuItem[]; align?: "start" | "end"; label?: string }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild aria-label={label}>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align={align} sideOffset={6} className="z-[60] min-w-52 rounded-lg border border-line bg-panel p-1 shadow-[var(--shadow-pop)] animate-[fade-in_.1s]">
          {items.map((it, i) => it === "separator" ? <Dropdown.Separator key={i} className="my-1 h-px bg-line-soft" /> : (
            <Dropdown.Item key={it.label} disabled={it.disabled} onSelect={it.onSelect}
              className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-panel-2", it.danger ? "text-err" : "text-fg")}>
              {it.icon && <span className="text-fg-3">{it.icon}</span>}
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="text-xs text-fg-3">{it.hint}</span>}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function Pop({ trigger, children, align = "start", width, open, onOpenChange }: { trigger: React.ReactNode; children: React.ReactNode | ((close: () => void) => React.ReactNode); align?: "start" | "center" | "end"; width?: number; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [inner, setInner] = useState(false);
  const o = open ?? inner, set = onOpenChange ?? setInner;
  return (
    <Popover.Root open={o} onOpenChange={set}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={6} style={width ? { width } : undefined} className="z-[60] rounded-lg border border-line bg-panel p-1.5 shadow-[var(--shadow-pop)] animate-[fade-in_.1s]">
          {typeof children === "function" ? children(() => set(false)) : children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---- Confirmation : await confirm({ title, … }) à la place de window.confirm
type ConfirmOpts = { title: string; description?: string; confirmLabel?: string; danger?: boolean; typeToConfirm?: string };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const [typed, setTyped] = useState("");
  const resolver = useRef<(v: boolean) => void>(() => {});
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((res) => { resolver.current = res; setTyped(""); setOpts(o); }), []);
  const close = (v: boolean) => { resolver.current(v); setOpts(null); };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal open={!!opts} onOpenChange={(o) => !o && close(false)} title={opts?.title ?? ""} description={opts?.description} size="sm"
        footer={<><Button onClick={() => close(false)}>Annuler</Button><Button variant={opts?.danger ? "danger" : "primary"} disabled={!!opts?.typeToConfirm && typed !== opts.typeToConfirm} onClick={() => close(true)}>{opts?.confirmLabel ?? "Confirmer"}</Button></>}>
        {opts?.typeToConfirm ? (
          <div className="grid gap-2">
            <p className="text-fg-2">Pour confirmer, saisissez <b className="mono text-fg">{opts.typeToConfirm}</b>.</p>
            <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && typed === opts.typeToConfirm && close(true)} />
          </div>
        ) : <span className="sr-only">Confirmation requise</span>}
      </Modal>
    </ConfirmCtx.Provider>
  );
}
