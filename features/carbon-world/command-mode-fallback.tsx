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
    <div className="min-h-screen bg-[#07110f]">
      <div className="border-b border-emerald-300/15 bg-emerald-300/[0.06] px-5 py-3 sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
            Command Mode · live portfolio data
          </p>
          <Link
            href="/"
            className="rounded-full border border-emerald-300/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100 transition hover:bg-emerald-300/10"
          >
            Return to 3D world
          </Link>
        </div>
        {reason ? (
          <p className="mx-auto mt-2 max-w-[1600px] text-xs text-slate-500">{reason}</p>
        ) : null}
      </div>
      <PortfolioDashboard focus={focus} initialData={initialData} />
    </div>
  );
}
