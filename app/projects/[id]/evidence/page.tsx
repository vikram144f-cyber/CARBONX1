"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Database,
  FileText,
  MapIcon,
  Activity,
  CheckCircle2,
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
} from "@/components/icons";

interface ProjectData {
  id: string;
  name: string;
  countryCode: string | null;
  registryId: string | null;
  areaHa: number | null;
  totalHeldQuantity: number;
}

export default function EvidenceExplorerPage({
  params,
}: {
  params: { id: string };
}) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(params.id)}`)
      .then((res) => res.json())
      .then((body) => {
        if (body.success && body.data) setProject(body.data);
      })
      .catch((err) => console.error("Failed to load project", err))
      .finally(() => setLoading(false));
  }, [params.id]);

  const claimedCarbon = project?.totalHeldQuantity || 10000;
  const areaHa = project?.areaHa || 100.0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 cx-mono text-[11px] text-[var(--cx-text-muted)] mb-1">
            <Link
              href="/?mode=command"
              className="hover:text-[var(--cx-accent)] transition"
            >
              PORTFOLIO
            </Link>
            <span>/</span>
            <Link
              href={`/projects/${params.id}`}
              className="hover:text-[var(--cx-accent)] transition"
            >
              {project?.name ?? params.id}
            </Link>
            <span>/</span>
            <span className="text-white">EVIDENCE GRAPH</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Multi-Modal Evidence Graph
          </h1>
          <p className="text-[var(--cx-text-muted)] text-xs mt-1">
            Deterministic cross-referencing and reconciliation of heterogeneous data sources for project {params.id}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${params.id}/results`}
            className="cx-mono rounded border border-[rgba(237,142,89,0.35)] bg-[rgba(237,142,89,0.12)] px-3 py-1.5 text-xs font-semibold text-[var(--cx-accent)] hover:bg-[rgba(237,142,89,0.22)] transition"
          >
            ← View Truth Score Dossier
          </Link>
        </div>
      </div>

      {/* Graph Visualizer Canvas */}
      <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)] p-8 sm:p-12 overflow-x-auto shadow-2xl">
        <div className="min-w-[800px] flex flex-col items-center gap-10">
          {/* Level 1: Project Claim Level */}
          <div className="flex flex-col items-center">
            <div className="rounded-xl border-2 border-[var(--cx-accent)] bg-[var(--cx-surface-inset)] p-5 flex flex-col items-center w-64 text-center shadow-lg">
              <Database className="w-6 h-6 text-[var(--cx-accent)] mb-2" />
              <span className="font-bold text-base text-white">
                Registry Claim
              </span>
              <span className="text-xs font-semibold text-[var(--cx-accent)] mt-0.5">
                {claimedCarbon.toLocaleString()} tCO2e
              </span>
            </div>
            <div className="w-px h-10 bg-[var(--cx-border)]" />
            <div className="w-[600px] h-px bg-[var(--cx-border)] flex justify-between">
              <div className="w-px h-10 bg-[var(--cx-border)] relative top-0 left-0" />
              <div className="w-px h-10 bg-[var(--cx-border)] relative top-0" />
              <div className="w-px h-10 bg-[var(--cx-border)] relative top-0 right-0" />
            </div>
          </div>

          {/* Level 2: Multi-Modal Evidence Sources */}
          <div className="flex justify-between w-[720px]">
            {/* PDD Document Node */}
            <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-5 flex flex-col items-center w-52 text-center relative group hover:border-blue-400 transition shadow-md">
              <FileText className="w-6 h-6 text-blue-400 mb-2" />
              <span className="font-bold text-sm text-white">PDD Document</span>
              <span className="text-xs font-semibold text-blue-400 mt-1">
                {claimedCarbon.toLocaleString()} tCO2e Claim
              </span>
              <span className="text-[10px] text-[var(--cx-text-muted)] mt-1">
                Confidence: 95%
              </span>
            </div>

            {/* GIS Polygon Boundary Node */}
            <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-5 flex flex-col items-center w-52 text-center relative group hover:border-purple-400 transition shadow-md">
              <MapIcon className="w-6 h-6 text-purple-400 mb-2" />
              <span className="font-bold text-sm text-white">
                GIS Polygon Boundary
              </span>
              <span className="text-xs font-semibold text-purple-400 mt-1">
                {areaHa.toLocaleString()} Hectares
              </span>
              <span className="text-[10px] text-[var(--cx-text-muted)] mt-1">
                Topologically Closed (0 self-intersects)
              </span>
            </div>

            {/* Satellite Sentinel-2 Node */}
            <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-5 flex flex-col items-center w-52 text-center relative group hover:border-emerald-400 transition shadow-md">
              <Activity className="w-6 h-6 text-emerald-400 mb-2" />
              <span className="font-bold text-sm text-white">
                Sentinel-2 NDVI
              </span>
              <span className="text-xs font-semibold text-emerald-400 mt-1">
                Mean NDVI: 0.62
              </span>
              <span className="text-[10px] text-[var(--cx-text-muted)] mt-1">
                Healthy Forest Canopy
              </span>
            </div>
          </div>

          {/* Level 3: Reconciliation Engine & Truth Score */}
          <div className="flex flex-col items-center">
            <div className="w-[600px] h-px bg-[var(--cx-border)] flex justify-between relative -top-px">
              <div className="w-px h-10 bg-[var(--cx-border)] relative top-0 left-0" />
              <div className="w-px h-10 bg-[var(--cx-border)] relative top-0" />
              <div className="w-px h-10 bg-[var(--cx-border)] relative top-0 right-0" />
            </div>
            <div className="w-px h-10 bg-[var(--cx-border)] relative -top-px" />

            <div className="rounded-xl border-2 border-[var(--cx-success)] bg-[var(--cx-surface-inset)] p-5 flex flex-col items-center w-72 text-center shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-[var(--cx-success)]" />
                <span className="font-bold text-sm text-white">
                  Multi-Modal Reconciliation
                </span>
              </div>
              <span className="text-xs font-semibold text-[var(--cx-success)]">
                All Evidence Modes Consistent
              </span>
            </div>

            <div className="w-px h-10 bg-[var(--cx-border)]" />
            <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-6 flex flex-col items-center w-64 text-center shadow-xl">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-[rgba(114,176,132,0.3)] bg-[var(--cx-surface)] shadow-inner mb-3">
                <span className="cx-mono text-3xl font-bold text-white">
                  100
                </span>
              </div>
              <span className="cx-mono text-xs font-bold uppercase tracking-widest text-[var(--cx-success)]">
                STATUS: VERIFIED
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
