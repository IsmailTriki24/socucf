"use client";
import { forwardRef } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: React.ReactNode };

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover font-semibold shadow-[0_1px_0_rgb(255_255_255/.25)_inset,0_6px_16px_-8px_var(--accent)]",
  secondary: "bg-panel-2 border border-line hover:border-accent/60 hover:bg-panel-3 text-fg",
  ghost: "text-fg-2 hover:text-fg hover:bg-panel-2",
  danger: "text-err border border-err/40 hover:bg-err/10",
};
const SIZE: Record<Size, string> = { sm: "h-8 px-2.5 text-[13px] gap-1.5", md: "h-9 px-3.5 gap-2", lg: "h-11 px-5 text-[15px] gap-2.5" };

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading} className={cn("inline-flex shrink-0 items-center justify-center rounded-md whitespace-nowrap transition-colors select-none disabled:opacity-50", VARIANT[variant], SIZE[size], className)} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md"; active?: boolean }>(function IconButton({ label, size = "md", active, className, children, ...rest }, ref) {
  return (
    <button ref={ref} aria-label={label} title={label} className={cn("inline-grid shrink-0 place-items-center rounded-md text-fg-2 transition-colors hover:bg-panel-2 hover:text-fg disabled:opacity-40", size === "sm" ? "size-7" : "size-9", active && "bg-panel-2 text-fg", className)} {...rest}>
      {children}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn("field", className)} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn("field leading-relaxed", className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cn("field", className)} {...rest} />;
});

export function Field({ label, hint, children, className, group }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={cn("grid content-start gap-1.5", className)}>
      <span className="text-[13px] font-medium text-fg-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-fg-3">{hint}</span>}
    </Tag>
  );
}

export function Segmented<T extends string>({ options, value, onChange, size = "md", className, label }: {
  options: { value: T; label: React.ReactNode; color?: string; title?: string }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md"; className?: string; label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-md border border-line bg-bg-2 p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} title={o.title} onClick={() => onChange(o.value)}
            className={cn("inline-flex items-center gap-1.5 rounded-[7px] font-medium transition-colors", size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-8 px-3", on ? "bg-panel-3 text-fg shadow-sm" : "text-fg-3 hover:text-fg")}
            style={on && o.color ? { boxShadow: `inset 0 -2px 0 ${o.color}` } : undefined}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:opacity-50", checked ? "border-accent bg-accent" : "border-line bg-panel-3")}>
      <span className={cn("absolute top-0.5 size-3.5 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <span className={cn("relative inline-grid size-4 shrink-0 place-items-center", className)}>
      <input type="checkbox" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="peer size-4 cursor-pointer appearance-none rounded-[5px] border border-line bg-bg-2 transition-colors checked:border-accent checked:bg-accent hover:border-accent/70" />
      <Check className="pointer-events-none absolute size-3 text-accent-ink opacity-0 peer-checked:opacity-100" strokeWidth={4} />
    </span>
  );
}

export function Chip({ children, color, className, onRemove, title }: { children: React.ReactNode; color?: string; className?: string; onRemove?: () => void; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex max-w-full items-center gap-1 rounded-md border border-line-soft bg-panel-2 px-1.5 py-0.5 text-xs text-fg-2", className)}
      style={color ? { borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, color, background: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}>
      <span className="truncate">{children}</span>
      {onRemove && <button type="button" aria-label="Retirer" onClick={onRemove} className="-mr-0.5 rounded px-0.5 opacity-70 hover:opacity-100">×</button>}
    </span>
  );
}

export function Avatar({ name, size = 28, hueDeg }: { name: string; size?: number; hueDeg?: number }) {
  const h = hueDeg ?? [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full font-semibold" aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${h} 45% 28%)`, color: `hsl(${h} 85% 85%)` }}>{initials(name)}</span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin text-fg-3", className)} aria-label="Chargement" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden />;
}

export function EmptyState({ icon, title, children, action, className }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid place-items-center gap-2 rounded-lg border border-dashed border-line px-6 py-12 text-center", className)}>
      {icon && <div className="mb-1 grid size-11 place-items-center rounded-full bg-panel-2 text-fg-3">{icon}</div>}
      <h3 className="text-base">{title}</h3>
      {children && <p className="max-w-md text-fg-3">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Notice({ kind = "info", children, className, action }: { kind?: "info" | "ok" | "warn" | "err"; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const c = { info: "var(--info)", ok: "var(--ok)", warn: "var(--warn)", err: "var(--err)" }[kind];
  return (
    <div role={kind === "err" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-md border px-3.5 py-2.5 text-[13.5px]", className)}
      style={{ borderColor: `color-mix(in srgb, ${c} 38%, transparent)`, background: `color-mix(in srgb, ${c} 10%, transparent)` }}>
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: c }} />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && <div className="mb-1 text-[13px] text-fg-3">{back}</div>}
        <h1 className="text-[26px] leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-fg-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Loading({ error, loading, onRetry }: { error?: string | null; loading?: boolean; onRetry?: () => void }) {
  if (error) return <Notice kind="err" action={onRetry && <Button size="sm" onClick={onRetry}>Réessayer</Button>}>{error}</Notice>;
  if (loading) return <div className="grid gap-3 py-2"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  return null;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function TabBar<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string; count?: number | string; warn?: boolean }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("scroll-thin mb-5 flex gap-1 overflow-x-auto border-b border-line-soft", className)}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn("relative -mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 text-[14px] transition-colors", value === t.id ? "border-accent font-semibold text-fg" : "border-transparent text-fg-3 hover:text-fg")}>
          {t.label}
          {t.count !== undefined && <span className={cn("mono rounded-full px-1.5 text-xs", value === t.id ? "bg-accent-soft text-accent" : "bg-panel-3 text-fg-3")}>{t.count}</span>}
          {t.warn && <span className="size-1.5 rounded-full bg-warn" aria-label="À compléter" />}
        </button>
      ))}
    </div>
  );
}
