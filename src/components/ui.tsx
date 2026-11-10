"use client";
import clsx from "clsx";
import { ChevronDown, Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT } from "@/i18n";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md" }) {
  return (
    <button
      {...p}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-[13px]",
        variant === "primary" && "border-[#1F2A44] bg-[#1F2A44] text-white hover:bg-[#2b3a5e]",
        variant === "secondary" && "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        variant === "danger" && "border-[#C92830] bg-[#C92830] text-white hover:bg-[#a81f26]",
        variant === "ghost" && "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
        className,
      )}
    />
  );
}

export function Card({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-md border border-slate-200 bg-white", className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <h3 className="text-[13px] font-semibold text-[#1F2A44]">{title}</h3>
          <div className="flex items-center gap-1.5">{right}</div>
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

const TONES = {
  info: { c: "border-sky-200 bg-sky-50 text-sky-900", i: Info },
  warn: { c: "border-amber-300 bg-amber-50 text-amber-900", i: AlertTriangle },
  error: { c: "border-red-300 bg-red-50 text-red-900", i: XCircle },
  ok: { c: "border-emerald-300 bg-emerald-50 text-emerald-900", i: CheckCircle2 },
};

/** Bilgi kartı: ekran içinde açıklayıcı not */
export function InfoCard({ tone = "info", title, children }: { tone?: keyof typeof TONES; title?: string; children?: ReactNode }) {
  const T = TONES[tone];
  const Icon = T.i;
  return (
    <div className={clsx("flex gap-2 rounded-md border px-3 py-2 text-[12.5px] leading-relaxed", T.c)} role={tone === "error" ? "alert" : "note"}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title && <div className="font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}

/** Açılır/kapanır açıklama alanı */
export function Collapsible({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[12.5px] font-medium text-slate-700 hover:bg-slate-100"
      >
        <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
        {title}
      </button>
      {open && <div className="border-t border-slate-200 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-slate-700">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "red" | "green" | "amber" }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={clsx(
          "text-xl font-semibold tabular-nums",
          tone === "red" ? "text-[#C92830]" : tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-[#1F2A44]",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "red" | "green" | "amber" | "blue" }) {
  const c = {
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-800",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-sky-100 text-sky-800",
  }[tone];
  return <span className={clsx("inline-block rounded px-1.5 py-0.5 text-[11px] font-medium", c)}>{children}</span>;
}

export function FillBar({ value, target }: { value: number; target?: number }) {
  const pct = Math.min(100, Math.round(value * 100));
  const color = value > 1 ? "bg-[#C92830]" : value >= 0.9 ? "bg-amber-500" : "bg-emerald-600";
  return (
    <div className="relative h-2 w-full rounded bg-slate-200" title={`%${Math.round(value * 100)}`}>
      <div className={clsx("h-2 rounded", color)} style={{ width: `${pct}%` }} />
      {target !== undefined && <div className="absolute top-[-2px] h-3 w-px bg-slate-700" style={{ left: `${Math.min(100, target * 100)}%` }} />}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-[12.5px]">
      <span className="mb-0.5 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11.5px] text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-8 w-full rounded border border-slate-300 bg-white px-2 text-[13px] text-slate-900 focus:border-[#1F2A44] focus:outline-none focus:ring-1 focus:ring-[#1F2A44]";

export function ScreenTitle({ no, title, children }: { no: number; title: string; children?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#C92830]">{t("v1ui.screen", { no })}</div>
        <h1 className="text-lg font-semibold text-[#1F2A44]">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
