import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    neutral: "border-cx-highlight/15 bg-cx-bg/55",
    green: "border-cx-accent/25 bg-cx-accent/10",
    amber: "border-amber-300/20 bg-amber-300/[0.06]",
    red: "border-red-300/20 bg-red-300/[0.06]",
    blue: "border-cx-highlight/20 bg-cx-purple/35",
  };
  return (
    <div className={`rounded-2xl border p-5 ${tones[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {detail ? <p className="mt-2 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function Panel({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`cx-panel rounded-2xl ${className}`}>{children}</section>;
}

export function PanelHeading({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
      <div>
        {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">{eyebrow}</p> : null}
        <h2 className="mt-1 text-base font-semibold text-white">{title}</h2>
      </div>
      {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function RiskBadge({ risk }: { risk: string | null }) {
  const styles: Record<string, string> = {
    LOW: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
    MEDIUM: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    HIGH: "border-orange-300/25 bg-orange-300/10 text-orange-200",
    CRITICAL: "border-red-300/25 bg-red-300/10 text-red-200",
  };
  const label = risk ?? "UNASSESSED";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${styles[label] ?? "border-slate-500/30 bg-slate-500/10 text-slate-400"}`}>{label}</span>;
}

export function EvidenceBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    OBSERVED: "bg-blue-300/10 text-blue-200 ring-blue-300/20",
    ESTIMATED: "bg-amber-300/10 text-amber-200 ring-amber-300/20",
    MODELED: "bg-violet-300/10 text-violet-200 ring-violet-300/20",
    INFERRED: "bg-slate-300/10 text-slate-200 ring-slate-300/20",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ring-1 ${styles[label] ?? styles.INFERRED}`}>{label}</span>;
}

export function LoadingState({ label = "Loading live portfolio data" }: { label?: string }) {
  return <div className="flex min-h-[50vh] items-center justify-center"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-300/20 border-t-emerald-300" /><p className="mt-4 text-sm text-slate-400">{label}</p></div></div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-40 items-center justify-center px-6 py-10 text-center"><div><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/40 text-slate-500">—</div><p className="mt-4 text-sm font-medium text-slate-300">{title}</p><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{detail}</p></div></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex min-h-40 items-center justify-center px-6 py-10 text-center"><div><p className="text-sm font-medium text-red-200">{message}</p><button onClick={onRetry} className="mt-4 rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-300/20">Retry read</button></div></div>;
}

export function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function formatCurrency(value: number | null, currency = "USD") {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
