"use client";

import Link from "next/link";
import { PortfolioDashboard } from "../../components/portfolio-dashboard";
import type { PortfolioResponse } from "../../lib/validations/portfolio";

export function CommandModeFallback({
  reason,
  focus,
  initialData,
}: {
  reason?: string;
  focus?: string;
  initialData?: PortfolioResponse | null;
}) {
  return (
    <div className="min-h-screen bg-[var(--cx-bg)]">
      <div className="border-b border-[var(--cx-border)] bg-[var(--cx-surface-inset)] px-5 py-2.5 sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--cx-accent)]" />
            <p className="cx-mono text-[10px] uppercase tracking-wider text-[var(--cx-text-secondary)]">
              Command Mode · 2D Geospatial Console
            </p>
          </div>
          <Link
            href="/"
            className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-accent)] transition hover:bg-[rgba(237,142,89,0.12)]"
          >
            Launch 3D World →
          </Link>
        </div>
        {reason ? (
          <p className="mx-auto mt-1 max-w-[1600px] text-xs text-[var(--cx-text-muted)]">
            {reason}
          </p>
        ) : null}
      </div>
      <PortfolioDashboard />
    </div>
  );
}

