"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "@/components/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootErrorBoundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
      <div className="rounded-2xl border border-[var(--cx-border)] bg-[var(--cx-surface)] p-8 max-w-md w-full shadow-2xl space-y-5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(229,107,120,0.3)] bg-[rgba(229,107,120,0.1)] text-[var(--cx-critical)]">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Application Error
          </h2>
          <p className="mt-2 text-xs text-[var(--cx-text-secondary)] leading-relaxed">
            {error.message || "An unexpected error occurred while loading this view."}
          </p>
          {error.digest && (
            <p className="cx-mono mt-1 text-[10px] text-[var(--cx-text-muted)]">
              Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="cx-mono inline-flex items-center gap-2 rounded-lg bg-[var(--cx-accent)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#121025] transition hover:bg-[var(--cx-accent-hover)] shadow-md"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </button>
          <Link
            href="/?mode=command"
            className="cx-mono rounded-lg border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--cx-text)] transition hover:border-[var(--cx-accent)] hover:text-[var(--cx-accent)]"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
