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
    <div className="cx-app-shell min-h-screen">
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        {!isWorldHome ? (
          <aside className="border-b border-[var(--cx-border)] bg-[var(--cx-bg)] px-5 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:flex-col lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
            {/* Brand / Station header */}
            <div className="flex items-center justify-between lg:block">
              <Link href="/?mode=command" className="group block">
                <div className="flex items-center gap-2.5">
                  <span className="cx-mono flex h-7 w-7 items-center justify-center rounded border border-[var(--cx-accent)] bg-[rgba(237,142,89,0.12)] text-[11px] font-bold text-[var(--cx-accent)]">
                    CX
                  </span>
                  <div>
                    <span className="cx-mono block text-xs font-bold tracking-[0.2em] text-[var(--cx-text)]">
                      CARBONX
                    </span>
                    <span className="block text-[9px] uppercase tracking-[0.14em] text-[var(--cx-text-muted)]">
                      Spatial Intelligence
                    </span>
                  </div>
                </div>
              </Link>

              {/* Mobile 3D shortcut */}
              <Link
                href="/"
                className="cx-mono rounded border border-[var(--cx-border)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--cx-accent)] lg:hidden"
              >
                3D World →
              </Link>
            </div>

            {/* Navigation links */}
            <nav className="mt-6 flex flex-wrap gap-1.5 lg:mt-8 lg:flex-col">
              <Link
                href="/?mode=command"
                className={`cx-mono flex flex-1 items-center justify-between rounded px-3 py-2 text-xs transition lg:flex-none ${
                  isPortfolio
                    ? "border border-[var(--cx-border-strong)] bg-[var(--cx-surface)] font-medium text-[var(--cx-text)]"
                    : "border border-transparent text-[var(--cx-text-muted)] hover:border-[var(--cx-border)] hover:bg-[var(--cx-surface-subtle)] hover:text-[var(--cx-text)]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isPortfolio ? "bg-[var(--cx-accent)]" : "bg-transparent"
                    }`}
                  />
                  Portfolio
                </span>
                <span className="text-[10px] text-[var(--cx-text-muted)]">01</span>
              </Link>

              <Link
                href="/documents"
                className={`cx-mono flex flex-1 items-center justify-between rounded px-3 py-2 text-xs transition lg:flex-none ${
                  isDocuments
                    ? "border border-[var(--cx-border-strong)] bg-[var(--cx-surface)] font-medium text-[var(--cx-text)]"
                    : "border border-transparent text-[var(--cx-text-muted)] hover:border-[var(--cx-border)] hover:bg-[var(--cx-surface-subtle)] hover:text-[var(--cx-text)]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isDocuments ? "bg-[var(--cx-accent)]" : "bg-transparent"
                    }`}
                  />
                  Documents
                </span>
                <span className="text-[10px] text-[var(--cx-text-muted)]">02</span>
              </Link>

              <Link
                href="/"
                className="cx-mono flex flex-1 items-center justify-between rounded border border-[var(--cx-border-subtle)] px-3 py-2 text-xs text-[var(--cx-accent)] transition hover:border-[var(--cx-accent)] hover:bg-[rgba(237,142,89,0.08)] lg:flex-none"
              >
                <span className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--cx-accent)]" />
                  3D Operations
                </span>
                <span className="text-[10px] opacity-60">3D</span>
              </Link>
            </nav>

            {/* Telemetry status footer */}
            <div className="mt-auto hidden border-t border-[var(--cx-border)] pt-4 lg:block">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--cx-success)]" />
                <span className="cx-mono text-[9px] uppercase tracking-[0.16em] text-[var(--cx-text-muted)]">
                  System Operational
                </span>
              </div>
              <p className="cx-mono mt-1 text-[10px] text-[var(--cx-text-muted)]">
                NASA FIRMS · Supabase · Turf.js
              </p>
            </div>
          </aside>
        ) : null}

        <main className={`min-w-0 flex-1 ${isWorldHome ? "w-full" : ""}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
