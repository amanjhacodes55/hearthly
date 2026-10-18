"use client";
import { useEffect, useId, useRef } from "react";
import clsx from "clsx";
import { X } from "lucide-react";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ccg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0b7a70" />
        </linearGradient>
      </defs>
      <path d="M14 6h36a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10H30l-11 9.5c-1.6 1.4-4 .2-4-1.9V48h-1A10 10 0 0 1 4 38V16A10 10 0 0 1 14 6z" fill="url(#ccg)" />
      <path d="M38.5 19.5a11 11 0 1 0 0 15" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="45" cy="27" r="4.2" fill="#f97362" />
    </svg>
  );
}
export function Logo({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className="h-display text-[1.2em] font-extrabold tracking-tight">
        Chat<span className="text-brand">Crip</span>
      </span>
    </span>
  );
}

export function Avatar({ name, image, size = 32, className, online }: { name?: string; image?: string; size?: number; className?: string; online?: boolean }) {
  const initials = (name || "?").trim().split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "?";
  const hue = [...(name || "x")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className={clsx("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-full rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex size-full items-center justify-center rounded-full font-bold text-white" style={{ fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue + 40) % 360} 60% 45%))` }}>
          {initials}
        </span>
      )}
      {online !== undefined && <span className={clsx("absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface", online ? "bg-success" : "bg-faint")} style={{ width: size * 0.32, height: size * 0.32 }} aria-label={online ? "online" : "offline"} />}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,textarea,select,button:not([data-close])")?.focus(), 20);
    return () => {
      window.removeEventListener("keydown", k);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className={clsx("card animate-pop w-full shadow-pop", wide ? "max-w-3xl" : "max-w-lg")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 id={id} className="text-base font-bold">{title}</h2>
          <button data-close onClick={onClose} className="btn-ghost btn-sm !p-1.5" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1.5">
      <span>
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={clsx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-surface-3")}>
        <span className={clsx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-surface/60 px-5 py-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        {icon && <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">{icon}</div>}
        <div>
          <h1 className="h-display text-xl font-bold md:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Tag({ name, color, onRemove }: { name: string; color?: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${color || "#64748b"} 16%, transparent)`, color: color || "var(--muted)" }}>
      #{name}
      {onRemove && (
        <button onClick={onRemove} aria-label={`Remove tag ${name}`} className="opacity-70 hover:opacity-100">
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

export function timeAgo(d: string | Date | null | undefined) {
  if (!d) return "—";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString();
}
export function shortTime(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (today.getTime() - date.getTime() < 6 * 86400_000) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
export function duration(ms: number | null | undefined) {
  if (ms === null || ms === undefined || isNaN(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}
export function fileSize(n: number) {
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
export function flag(code?: string) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
export function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button type="button" className="btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(text)}>
      {label}
    </button>
  );
}
