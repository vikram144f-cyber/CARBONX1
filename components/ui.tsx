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
  const toneIndicators = {
    neutral: "bg-cx-muted/40",
    green: "bg-[var(--cx-success)]",
    amber: "bg-[var(--cx-warning)]",
    red: "bg-[var(--cx-critical)]",
    blue: "bg-[var(--cx-info)]",
  };

  return (
    <div className="flex flex-col justify-between py-1">
      <div>
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${toneIndicators[tone]}`} />
          <span className="cx-label text-[10px] text-cx-muted">{label}</span>
        </div>
        <p className="cx-mono mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {value}
        </p>
      </div>
      {detail ? (
        <p className="mt-1 text-[11px] leading-4 text-cx-muted">{detail}</p>
      ) : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`cx-surface rounded-lg overflow-hidden border border-[var(--cx-border)] ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--cx-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        {eyebrow ? (
          <p className="cx-eyebrow">{eyebrow}</p>
        ) : null}
        <h2 className="mt-0.5 text-sm font-semibold tracking-wide text-[var(--cx-text)]">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-3">
        {detail ? (
          <span className="text-xs text-[var(--cx-text-muted)]">{detail}</span>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export function RiskBadge({ risk }: { risk: string | null }) {
  const styles: Record<string, string> = {
    LOW: "border-[rgba(114,176,132,0.3)] bg-[rgba(114,176,132,0.1)] text-[#9fc6a8]",
    MEDIUM: "border-[rgba(237,142,89,0.3)] bg-[rgba(237,142,89,0.1)] text-[#ed8e59]",
    HIGH: "border-[rgba(245,173,122,0.35)] bg-[rgba(245,173,122,0.1)] text-[#f5ad7a]",
    CRITICAL: "border-[rgba(229,107,120,0.35)] bg-[rgba(229,107,120,0.1)] text-[#e56b78]",
  };
  const label = risk ?? "UNASSESSED";
  return (
    <span
      className={`cx-mono inline-flex items-center rounded px-2 py-0.5 text-[9px] font-semibold tracking-wider border ${
        styles[label] ?? "border-[var(--cx-border)] bg-transparent text-[var(--cx-text-muted)]"
      }`}
    >
      {label}
    </span>
  );
}

export function EvidenceBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    OBSERVED: "border-blue-400/30 bg-blue-500/10 text-blue-200",
    ESTIMATED: "border-[rgba(237,142,89,0.3)] bg-[rgba(237,142,89,0.1)] text-[#ed8e59]",
    MODELED: "border-purple-400/30 bg-purple-500/10 text-purple-200",
    INFERRED: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  };
  return (
    <span
      className={`cx-mono inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${
        styles[label] ?? styles.INFERRED
      }`}
    >
      {label}
    </span>
  );
}

export function LoadingState({
  label = "Loading live data",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <div className="flex items-center gap-3 text-xs text-[var(--cx-text-muted)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--cx-accent)]" />
        <span className="cx-mono tracking-wider uppercase text-[11px]">{label}…</span>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-32 items-center justify-center px-6 py-8 text-center">
      <div className="max-w-md">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--cx-text-secondary)]">
          {title}
        </p>
        <p className="mt-1.5 text-xs leading-5 text-[var(--cx-text-muted)]">{detail}</p>
      </div>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-32 items-center justify-center px-6 py-8 text-center">
      <div className="max-w-md">
        <p className="text-xs font-medium text-[var(--cx-critical)]">{message}</p>
        <button
          onClick={onRetry}
          className="cx-mono mt-3 rounded border border-[var(--cx-border)] bg-[var(--cx-surface-subtle)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text)] transition hover:border-[var(--cx-accent)]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function formatCurrency(value: number | null, currency = "USD") {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
