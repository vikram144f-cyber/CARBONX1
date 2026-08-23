"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isWorldHome = pathname === "/" && searchParams.get("mode") !== "command";
  const isPortfolio = pathname === "/" && searchParams.get("mode") === "command";
  const isDocuments = pathname === "/documents";

  return (
    <div className="cx-app-shell min-h-screen text-slate-100">
      <div className="cx-ambient pointer-events-none fixed inset-0" />
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        {!isWorldHome ? (
          <aside className="cx-surface-elevated border-b border-white/10 px-5 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
            <Link href="/?mode=command" className="group flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-sm font-bold text-emerald-300 shadow-[0_0_28px_rgba(52,211,153,0.12)]">
                CX
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-[0.24em] text-white">CARBONX</span>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-emerald-300/60">Command mode</span>
              </span>
            </Link>

            <nav className="mt-8 flex flex-wrap gap-2 lg:flex-col">
              <Link
                href="/?mode=command"
                className={`group flex flex-1 items-center justify-between rounded-xl border px-3 py-3 text-sm transition lg:flex-none ${
                  isPortfolio
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                    : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${isPortfolio ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]" : "bg-slate-600"}`} />
                  Portfolio
                </span>
                <span className="text-[10px] tracking-[0.2em] text-slate-600">01</span>
              </Link>

              <Link
                href="/documents"
                className={`group flex flex-1 items-center justify-between rounded-xl border px-3 py-3 text-sm transition lg:flex-none ${
                  isDocuments
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                    : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${isDocuments ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]" : "bg-slate-600"}`} />
                  Documents
                </span>
                <span className="text-[10px] tracking-[0.2em] text-slate-600">02</span>
              </Link>

              <Link
                href="/"
                className="group flex flex-1 items-center justify-between rounded-xl border border-white/5 px-3 py-3 text-sm text-cyan-300/80 transition hover:border-cyan-400/20 hover:bg-cyan-400/5 hover:text-cyan-200 lg:flex-none"
              >
                <span className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  3D Operations
                </span>
                <span className="text-[10px] tracking-[0.2em] text-cyan-500/60">3D</span>
              </Link>
            </nav>

            <div className="mt-auto hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:block">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_9px_rgba(110,231,183,0.8)]" />
                System online
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Deterministic assessment data remains the source of truth.</p>
            </div>
          </aside>
        ) : null}
        <main className={`min-w-0 flex-1 ${isWorldHome ? "w-full" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
