"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Database, MapIcon, Plus } from "@/components/icons";
import { LoadingState } from "@/components/ui";

interface ProjectRecord {
  id: string;
  name: string;
  registryId: string | null;
  boundaryQuality: string | null;
  areaHa: number | null;
  latestAssessmentAt: string | null;
}

export default function DocumentsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((res) => res.json())
      .then((envelope) => {
        const payload = envelope?.data ?? envelope;
        setProjects(Array.isArray(payload?.projects) ? payload.projects : []);
      })
      .catch((error) => console.error("Project record fetch failed", error))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading project record archive" />;

  const registeredCount = projects.filter((project) => project.registryId).length;
  const assessedCount = projects.filter((project) => project.latestAssessmentAt).length;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-4 border-b border-[var(--cx-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 cx-mono text-[11px] text-[var(--cx-text-muted)]">
            <Link href="/?mode=command" className="transition hover:text-[var(--cx-accent)]">PORTFOLIO</Link>
            <span>/</span>
            <span className="text-white">PROJECT RECORD ARCHIVE</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Project Records & Boundary Provenance</h1>
          <p className="mt-1 text-xs text-[var(--cx-text-muted)]">
            API-backed metadata only. PDD files and blockchain anchors are shown only when their records exist.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="cx-mono flex items-center gap-2 self-start rounded border border-[rgba(237,142,89,0.4)] bg-[rgba(237,142,89,0.12)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--cx-accent)] transition hover:bg-[rgba(237,142,89,0.22)] sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" /> Register project
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="cx-portfolio-kpi border-[#5c7cff]/25 bg-[#1b2e71]/75 text-[#8fa8ff]">
          <p className="cx-label text-[9px] text-[#a9b9e9]">PROJECT RECORDS</p>
          <p className="cx-mono mt-2 text-2xl font-semibold text-white">{projects.length}</p>
          <p className="mt-3 text-[11px] text-[#9eadd7]">Returned by the portfolio API</p>
        </div>
        <div className="cx-portfolio-kpi border-[#48d7ae]/25 bg-[#123e4a]/75 text-[#63e8c4]">
          <p className="cx-label text-[9px] text-[#a9b9e9]">REGISTERED REFERENCES</p>
          <p className="cx-mono mt-2 text-2xl font-semibold text-white">{registeredCount}</p>
          <p className="mt-3 text-[11px] text-[#9eadd7]">No placeholder registry IDs</p>
        </div>
        <div className="cx-portfolio-kpi border-[#ed8e59]/25 bg-[#3d2a36]/75 text-[#f4b08a]">
          <p className="cx-label text-[9px] text-[#a9b9e9]">ASSESSED PROJECTS</p>
          <p className="cx-mono mt-2 text-2xl font-semibold text-white">{assessedCount}</p>
          <p className="mt-3 text-[11px] text-[#9eadd7]">Projects with a stored risk assessment</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--cx-border)] bg-[var(--cx-surface-inset)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--cx-accent)]" />
            <span className="cx-mono text-xs font-bold uppercase tracking-wider text-white">Stored project manifest</span>
          </div>
          <span className="cx-mono text-[11px] text-[var(--cx-text-muted)]">{projects.length} API-backed records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--cx-border)] bg-[var(--cx-surface-inset)]/50 cx-mono text-[var(--cx-text-muted)]">
                <th className="px-6 py-3 font-semibold uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider">Registry reference</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider">Boundary</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider">Latest assessment</th>
                <th className="px-6 py-3 text-right font-semibold uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cx-border)]">
              {projects.map((project) => (
                <tr key={project.id} className="transition hover:bg-[var(--cx-surface-subtle)]">
                  <td className="px-6 py-4">
                    <Link href={`/projects/${project.id}`} className="flex items-center gap-3 font-semibold text-white transition hover:text-[var(--cx-accent)]">
                      <MapIcon className="h-4 w-4 shrink-0 text-[#48d7ae]" />
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 cx-mono text-[var(--cx-text-secondary)]">{project.registryId ?? "Unregistered"}</td>
                  <td className="px-6 py-4 cx-mono text-[var(--cx-text-secondary)]">
                    {project.boundaryQuality ?? "UNKNOWN"} · {project.areaHa == null ? "area unavailable" : `${project.areaHa.toLocaleString()} ha`}
                  </td>
                  <td className="px-6 py-4 cx-mono text-[var(--cx-text-muted)]">{project.latestAssessmentAt ?? "Not assessed"}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/projects/${project.id}`} className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] px-2.5 py-1 text-[11px] text-[var(--cx-text-secondary)] transition hover:border-[var(--cx-accent)] hover:text-white">
                      Inspect record
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
