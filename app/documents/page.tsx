import Link from "next/link";
import { Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <Panel className="p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="cx-eyebrow">DOCUMENT STATION</span>
          <span className="text-[var(--cx-border)]">/</span>
          <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
            EVIDENCE REPOSITORY
          </span>
        </div>

        <h1 className="mt-3 text-xl font-medium tracking-tight text-white sm:text-2xl">
          Document station is not yet available.
        </h1>

        <p className="mt-3 text-xs leading-relaxed text-[var(--cx-text-secondary)]">
          Evidence labels, source metadata, and deterministic assessment context are available directly on individual incident dossiers. Document upload and PDF notarization workflows have not been activated in this build.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/?mode=command"
            className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface-subtle)] px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--cx-text)] transition hover:border-[var(--cx-accent)] hover:text-[var(--cx-accent)]"
          >
            ← Return to Portfolio
          </Link>
          <Link
            href="/"
            className="cx-mono rounded border border-[var(--cx-border-subtle)] px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-muted)] hover:border-[var(--cx-border)] hover:text-[var(--cx-text)]"
          >
            3D Operations
          </Link>
        </div>
      </Panel>
    </div>
  );
}
