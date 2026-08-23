"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TrustScoreCard } from "@/components/trust-score-card";
import { LoadingState, ErrorState } from "@/components/ui";

interface ProjectMeta {
  id: string;
  name: string;
  countryCode: string | null;
  registryId: string | null;
  areaHa: number | null;
}

export default function ProjectResultsPage({
  params,
}: {
  params: { id: string };
}) {
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(params.id)}`)
      .then((res) => res.json())
      .then((body) => {
        if (body.success && body.data) {
          setProject(body.data);
        } else {
          setError("Project record not found");
        }
      })
      .catch(() => setError("Failed to load project details"))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <LoadingState label="Loading AI Trust Score Dossier" />;
  if (error || !project) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-12">
        <ErrorState
          message={error ?? "Project not available"}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 sm:py-8">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 cx-mono text-[11px] text-[var(--cx-text-muted)]">
        <Link
          href="/?mode=command"
          className="transition hover:text-[var(--cx-accent)]"
        >
          PORTFOLIO
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${project.id}`}
          className="transition hover:text-[var(--cx-accent)]"
        >
          {project.name}
        </Link>
        <span>/</span>
        <span className="text-[var(--cx-text)]">AI TRUST SCORE VERIFICATION</span>
      </div>

      {/* Header */}
      <header className="mt-3 border-b border-[var(--cx-border)] pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="cx-eyebrow">AI VERIFICATION ENGINE</span>
              <span className="text-[var(--cx-border)]">/</span>
              <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                MULTI-MODAL EVIDENCE SYNTHESIS
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-medium tracking-tight text-white sm:text-3xl">
              AI Truth Score & Evidence Verification: {project.name}
            </h1>
            <p className="cx-mono mt-1 text-[11px] text-[var(--cx-text-muted)]">
              Registry Ref: {project.registryId ?? "VCS UNREGISTERED"} · Country:{" "}
              {project.countryCode ?? "—"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${project.id}`}
              className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--cx-text)] transition hover:border-[var(--cx-accent)] hover:text-[var(--cx-accent)]"
            >
              ← Project Spatial View
            </Link>
            <Link
              href="/?mode=command"
              className="cx-mono rounded border border-[var(--cx-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-muted)] transition hover:text-white"
            >
              Portfolio Console
            </Link>
          </div>
        </div>
      </header>

      {/* AI Trust Score Verification Card */}
      <TrustScoreCard projectId={project.id} />
    </div>
  );
}
