import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-5 text-center">
      <div className="rounded-2xl border border-[var(--cx-border)] bg-[var(--cx-surface)] p-8 max-w-md w-full shadow-2xl space-y-4">
        <span className="cx-mono text-4xl font-black text-[var(--cx-accent)]">
          404
        </span>
        <h2 className="text-xl font-bold tracking-tight text-white">
          Record Not Found
        </h2>
        <p className="text-xs text-[var(--cx-text-secondary)]">
          The requested project, incident, or verification dossier does not exist or has been moved.
        </p>
        <div className="pt-2">
          <Link
            href="/?mode=command"
            className="cx-mono inline-flex items-center gap-2 rounded-lg bg-[var(--cx-accent)] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#121025] hover:bg-[var(--cx-accent-hover)] transition shadow-lg"
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
