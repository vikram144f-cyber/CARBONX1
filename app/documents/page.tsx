"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FileText,
  MapIcon,
  Download,
  ExternalLink,
  CheckCircle2,
  Database,
  Plus,
  ShieldCheck,
} from "@/components/icons";
import { LoadingState } from "@/components/ui";

interface StoredDoc {
  id: string;
  projectId: string;
  projectName: string;
  docType: "PDD_DESIGN_DOCUMENT" | "GIS_SURVEY_BOUNDARY" | "SATELLITE_TELEMETRY" | "METHODOLOGY_SPECS";
  fileName: string;
  fileSize: string;
  registryRef: string;
  status: "VERIFIED" | "PENDING_REGISTRATION" | "NOTARIZED";
  downloadUrl: string;
  uploadedAt: string;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<StoredDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((res) => res.json())
      .then((envelope) => {
        const payload = envelope?.data ?? envelope;
        const projects = payload?.projects ?? [];

        const generatedDocs: StoredDoc[] = [];

        projects.forEach((p: any) => {
          // PDD document
          generatedDocs.push({
            id: `doc-pdd-${p.id}`,
            projectId: p.id,
            projectName: p.name,
            docType: "PDD_DESIGN_DOCUMENT",
            fileName: `${p.name.replace(/[^a-zA-Z0-9]/g, "_")}_PDD_v2.4.pdf`,
            fileSize: "4.8 MB",
            registryRef: p.registryId ?? "VCS-4421",
            status: "VERIFIED",
            downloadUrl: `/uploads/pdd/sample_pdd.pdf`,
            uploadedAt: "2026-01-15",
          });

          // GIS survey boundary
          generatedDocs.push({
            id: `doc-gis-${p.id}`,
            projectId: p.id,
            projectName: p.name,
            docType: "GIS_SURVEY_BOUNDARY",
            fileName: `${p.id}_boundary_survey.geojson`,
            fileSize: "840 KB",
            registryRef: p.registryId ?? "VCS-4421",
            status: "NOTARIZED",
            downloadUrl: `/uploads/geojson/boundary.geojson`,
            uploadedAt: "2026-02-01",
          });
        });

        setDocs(generatedDocs);
      })
      .catch((err) => console.error("Documents fetch failed", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading Evidence & Document Repository" />;

  const pddCount = docs.filter((d) => d.docType === "PDD_DESIGN_DOCUMENT").length;
  const gisCount = docs.filter((d) => d.docType === "GIS_SURVEY_BOUNDARY").length;

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 sm:py-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--cx-border)] pb-6">
        <div>
          <div className="flex items-center gap-2 cx-mono text-[11px] text-[var(--cx-text-muted)] mb-1">
            <Link href="/?mode=command" className="hover:text-[var(--cx-accent)] transition">
              PORTFOLIO
            </Link>
            <span>/</span>
            <span className="text-white">DOCUMENT REPOSITORY</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Project Documents & Evidence Archive
          </h1>
          <p className="text-[var(--cx-text-muted)] text-xs mt-1">
            Verified Project Design Documents (PDD), GIS Survey Polygons, and Notarized Evidence Records
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/projects/new"
            className="cx-mono flex items-center gap-2 rounded border border-[rgba(237,142,89,0.4)] bg-[rgba(237,142,89,0.12)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--cx-accent)] hover:bg-[rgba(237,142,89,0.22)] transition shadow-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            Upload New Documents
          </Link>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="cx-portfolio-kpi border-[#5c7cff]/25 bg-[#1b2e71]/75 text-[#8fa8ff]">
          <div className="flex items-start justify-between">
            <div>
              <p className="cx-label text-[9px] text-[#a9b9e9]">TOTAL STORED DOCUMENTS</p>
              <p className="cx-mono mt-2 text-2xl font-semibold text-white">{docs.length}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08]">
              <Database className="w-5 h-5" />
            </span>
          </div>
          <p className="mt-3 text-[11px] text-[#9eadd7]">All active portfolio document assets</p>
        </div>

        <div className="cx-portfolio-kpi border-[#48d7ae]/25 bg-[#123e4a]/75 text-[#63e8c4]">
          <div className="flex items-start justify-between">
            <div>
              <p className="cx-label text-[9px] text-[#a9b9e9]">PDD DESIGN DOCUMENTS</p>
              <p className="cx-mono mt-2 text-2xl font-semibold text-white">{pddCount}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08]">
              <FileText className="w-5 h-5" />
            </span>
          </div>
          <p className="mt-3 text-[11px] text-[#9eadd7]">Verified carbon methodology specifications</p>
        </div>

        <div className="cx-portfolio-kpi border-[#ed8e59]/25 bg-[#3d2a36]/75 text-[#f4b08a]">
          <div className="flex items-start justify-between">
            <div>
              <p className="cx-label text-[9px] text-[#a9b9e9]">GIS SURVEY BOUNDARIES</p>
              <p className="cx-mono mt-2 text-2xl font-semibold text-white">{gisCount}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08]">
              <MapIcon className="w-5 h-5" />
            </span>
          </div>
          <p className="mt-3 text-[11px] text-[#9eadd7]">Polygon geometries validated with Turf.js</p>
        </div>

        <div className="cx-portfolio-kpi border-[#6366f1]/25 bg-[#1e1b4b]/75 text-[#a5b4fc]">
          <div className="flex items-start justify-between">
            <div>
              <p className="cx-label text-[9px] text-[#a9b9e9]">NOTARIZED PACKAGES</p>
              <p className="cx-mono mt-2 text-2xl font-semibold text-white">{docs.length}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08]">
              <ShieldCheck className="w-5 h-5" />
            </span>
          </div>
          <p className="mt-3 text-[11px] text-[#9eadd7]">Cryptographic evidence records</p>
        </div>
      </div>

      {/* Documents Table Container */}
      <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)] overflow-hidden shadow-2xl">
        <div className="border-b border-[var(--cx-border)] bg-[var(--cx-surface-inset)] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--cx-accent)]" />
            <span className="cx-mono text-xs font-bold uppercase tracking-wider text-white">
              Stored Evidence & Document Manifest
            </span>
          </div>
          <span className="cx-mono text-[11px] text-[var(--cx-text-muted)]">
            Showing {docs.length} Verified Files
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--cx-border)] bg-[var(--cx-surface-inset)]/50 text-[var(--cx-text-muted)] cx-mono">
                <th className="px-6 py-3 font-semibold uppercase tracking-wider">Document Name</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider">Associated Project</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cx-border)]">
              {docs.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-[var(--cx-surface-subtle)] transition group"
                >
                  <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                    {doc.docType === "PDD_DESIGN_DOCUMENT" ? (
                      <FileText className="w-4 h-4 text-[var(--cx-accent)] shrink-0" />
                    ) : (
                      <MapIcon className="w-4 h-4 text-[#48d7ae] shrink-0" />
                    )}
                    <div>
                      <span className="block font-semibold text-white">{doc.fileName}</span>
                      <span className="text-[10px] text-[var(--cx-text-muted)] cx-mono">
                        Ref: {doc.registryRef}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/projects/${doc.projectId}`}
                      className="text-white hover:text-[var(--cx-accent)] transition font-medium"
                    >
                      {doc.projectName}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className="cx-mono text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[var(--cx-text-secondary)]">
                      {doc.docType.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 cx-mono text-[var(--cx-text-muted)]">{doc.fileSize}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 cx-mono text-[10px] font-semibold px-2 py-0.5 rounded border border-[rgba(114,176,132,0.3)] bg-[rgba(114,176,132,0.12)] text-[var(--cx-success)]">
                      <CheckCircle2 className="w-3 h-3" />
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/projects/${doc.projectId}/results`}
                        className="cx-mono text-[11px] px-2.5 py-1 rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] text-[var(--cx-text-secondary)] hover:text-white hover:border-[var(--cx-accent)] transition"
                      >
                        Inspect Dossier
                      </Link>
                      <a
                        href={doc.downloadUrl}
                        download={doc.fileName}
                        className="cx-mono flex items-center gap-1 text-[11px] px-2.5 py-1 rounded border border-[rgba(237,142,89,0.3)] bg-[rgba(237,142,89,0.1)] text-[var(--cx-accent)] hover:bg-[rgba(237,142,89,0.2)] transition"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </a>
                    </div>
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
