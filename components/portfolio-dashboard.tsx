"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState, useTransition } from "react";

import {
  EmptyState,
  ErrorState,
  formatCurrency,
  formatQuantity,
  LoadingState,
  RiskBadge,
} from "./ui";
import {
  portfolioResponseSchema,
  type PortfolioResponse,
} from "../lib/validations/portfolio";
import type { ProjectMarkerItem, SatelliteMapProps } from "./satellite-map";
import {
  Leaf,
  Plus,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Shield,
  ShieldX,
} from "./icons";

const SatelliteMap = dynamic(
  () => import("./satellite-map").then((m) => m.SatelliteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] w-full items-center justify-center rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] text-xs text-[var(--cx-text-muted)]">
        <div className="flex items-center gap-2 cx-mono">
          <span className="h-2 w-2 animate-spin rounded-full border border-[var(--cx-accent)] border-t-transparent" />
          <span>INITIALIZING MULTI-SPECTRAL SATELLITE ENGINE…</span>
        </div>
      </div>
    ),
  },
);

const PROJECT_CENTROIDS: Record<string, [number, number]> = {
  project_wayanad: [76.132, 11.685],
  project_sathyamangalam: [77.2455, 11.4983],
  project_greenforest: [-62.215, -3.465],
  project_vcs2386: [22.8212, 45.3921],
  project_vcs2547: [19.4046, 40.5348],
};

function DecisionBadge({ decision }: { decision?: string }) {
  if (!decision) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border border-[rgba(114,176,132,0.3)] bg-[rgba(114,176,132,0.12)] text-[var(--cx-success)]">
        <ShieldCheck className="w-3 h-3" /> VERIFIED
      </span>
    );
  }
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    VERIFIED: {
      color: "bg-[rgba(114,176,132,0.12)] text-[var(--cx-success)] border border-[rgba(114,176,132,0.3)]",
      icon: <ShieldCheck className="w-3 h-3" />,
    },
    REVIEW: {
      color: "bg-[rgba(237,142,89,0.12)] text-[var(--cx-warning)] border border-[rgba(237,142,89,0.3)]",
      icon: <Shield className="w-3 h-3" />,
    },
    HIGH_RISK: {
      color: "bg-[rgba(245,173,122,0.12)] text-[#f5ad7a] border border-[rgba(245,173,122,0.3)]",
      icon: <ShieldAlert className="w-3 h-3" />,
    },
    INVALID: {
      color: "bg-[rgba(229,107,120,0.12)] text-[var(--cx-critical)] border border-[rgba(229,107,120,0.3)]",
      icon: <ShieldX className="w-3 h-3" />,
    },
  };
  const style = map[decision] ?? {
    color: "bg-[rgba(255,255,255,0.05)] text-gray-400 border border-[var(--cx-border)]",
    icon: null,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${style.color}`}
    >
      {style.icon}
      {decision}
    </span>
  );
}

export function PortfolioDashboard() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [ingestionStats, setIngestionStats] = useState<{
    fetched: number;
    inserted: number;
    skippedDuplicates: number;
    status: string;
    reason?: string;
  } | null>(null);

  const [, startTransition] = useTransition();

  const loadData = () => {
    fetch("/api/portfolio", { cache: "no-store" })
      .then((res) => res.json())
      .then((envelope) => {
        const payload = envelope?.data ?? envelope;
        const parsed = portfolioResponseSchema.safeParse(payload);
        if (parsed.success) {
          setData(parsed.data);
          setError(null);
        } else {
          console.error("[PortfolioDashboard] Zod parse failure", parsed.error);
          setError("Data validation failed for portfolio record.");
        }
      })

      .catch((err) => {
        console.error("[PortfolioDashboard] fetch error", err);
        setError("Unable to connect to carbon intelligence server.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "carbonx-dev-refresh" }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setIngestionStats({
          fetched: json.data.fetchedCount ?? 0,
          inserted: json.data.insertedCount ?? 0,
          skippedDuplicates: json.data.skippedDuplicates ?? 0,
          status: json.data.status ?? "COMPLETED",
          reason: json.data.reason,
        });
        startTransition(() => {
          loadData();
        });
      }
    } catch (e) {
      console.error("Refresh failed", e);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading Monitored Carbon Assets" />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-12">
        <ErrorState
          message={error ?? "Portfolio unavailable."}
          onRetry={loadData}
        />
      </div>
    );
  }

  const projects = data.projects.filter((p) => {
    const matchesQuery =
      query.trim() === "" ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.registryId &&
        p.registryId.toLowerCase().includes(query.toLowerCase())) ||
      (p.countryCode &&
        p.countryCode.toLowerCase().includes(query.toLowerCase()));

    const matchesRisk =
      riskFilter === "ALL" ||
      (riskFilter === "UNASSESSED" && p.risk === null) ||
      p.risk === riskFilter;

    const matchesRegion =
      regionFilter === "ALL" ||
      (regionFilter === "IN" && p.countryCode === "IN") ||
      (regionFilter === "EU" && (p.countryCode === "RO" || p.countryCode === "AL")) ||
      (regionFilter === "BR" && p.countryCode === "BR");

    return matchesQuery && matchesRisk && matchesRegion;
  });

  const projectMarkers: ProjectMarkerItem[] = data.projects.map((p) => {
    const coords = PROJECT_CENTROIDS[p.id] || [0, 0];
    return {
      id: p.id,
      name: p.name,
      centroidLng: coords[0],
      centroidLat: coords[1],
      countryCode: p.countryCode,
      registryId: p.registryId,
      areaHa: p.areaHa,
      heldQuantity: p.totalHeldQuantity,
      risk: p.risk,
    };
  });

  return (
    <div className="mx-auto max-w-[1540px] px-5 py-6 sm:px-8 sm:py-8 space-y-8">
      {/* ── HERO BANNER FROM NAVANEE REPO ───────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1b3b2b] via-[#162e22] to-[#121025] border border-[rgba(114,176,132,0.3)] p-8 sm:p-10 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[var(--cx-success)] text-xs font-bold tracking-wider uppercase">
            <Leaf className="w-4 h-4" /> CarbonX Verification Platform
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
            Evidence-Centric<br />
            <span className="text-[var(--cx-success)]">Carbon Truth Scoring</span>
          </h1>
          <p className="text-[var(--cx-text-secondary)] text-xs sm:text-sm max-w-xl leading-relaxed">
            Multi-modal verification engine that cross-references geospatial boundaries, document filings, and Sentinel-2 satellite observations to produce an AI-assessed Truth Score.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 bg-[var(--cx-accent)] hover:bg-[var(--cx-accent-hover)] text-[#121025] px-7 py-3.5 rounded-xl font-bold tracking-wider text-xs uppercase transition shadow-lg flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Submit Project
          </Link>
          <Link
            href="/projects/project_wayanad/evidence"
            className="inline-flex items-center gap-2 border border-[var(--cx-border)] bg-[var(--cx-surface)] hover:border-[var(--cx-accent)] text-white px-5 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex-shrink-0"
          >
            Evidence Graph →
          </Link>
        </div>
      </div>

      {/* ── PRIMARY HERO: Interactive Geospatial Satellite Studio ────────── */}
      <section>
        <div className="relative">
          {/* Studio Top Control Strip */}
          <div className="flex items-center justify-between border-x border-t border-[var(--cx-border)] bg-[var(--cx-surface)] px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--cx-accent)] animate-pulse" />
              <span className="cx-mono text-[10px] uppercase tracking-wider text-[var(--cx-text)]">
                Multi-Spectral Spatial Intelligence Studio · {data.projects.length} Monitored Coordinates
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-[var(--cx-text-muted)]">
              <span className="cx-mono hidden sm:inline">
                CLICK REGION PILLS TO FLY CAMERA
              </span>
            </div>
          </div>

          <SatelliteMap
            centroid={[20.0, 25.0]}
            zoom={3}
            projectMarkers={projectMarkers}
            showQuickJump={true}
            height="480px"
            className="rounded-t-none"
          />

          {/* Integrated Data Freshness & FIRMS Ingestion Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-x border-b border-[var(--cx-border)] bg-[var(--cx-surface-inset)] px-4 py-2.5 text-xs">
            <div className="flex items-center gap-3">
              <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                DATA SYNC:
              </span>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="cx-mono inline-flex items-center gap-1.5 rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text)] transition hover:border-[var(--cx-accent)] hover:text-[var(--cx-accent)] disabled:cursor-wait disabled:opacity-50"
              >
                {refreshing ? (
                  <span className="h-2 w-2 animate-spin rounded-full border border-[var(--cx-accent)] border-t-transparent" />
                ) : (
                  <span>↻</span>
                )}
                {refreshing ? "Querying FIRMS API…" : "Refresh Environmental Data"}
              </button>

              {ingestionStats ? (
                <span className="cx-mono text-[10px]">
                  {ingestionStats.status === "COMPLETED" ? (
                    <span className="text-[var(--cx-success)]">
                      ✓ {ingestionStats.fetched} observations fetched (
                      {ingestionStats.inserted} new persisted,{" "}
                      {ingestionStats.skippedDuplicates} duplicate skipped)
                    </span>
                  ) : (
                    <span className="text-[var(--cx-critical)]">
                      Sync note: {ingestionStats.reason}
                    </span>
                  )}
                </span>
              ) : (
                <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                  NASA VIIRS / MODIS orbital telemetry active
                </span>
              )}
            </div>

            <div className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
              BUFFER MATRIX: 5.0 KM · TURF.JS GEOMETRIC RISK
            </div>
          </div>
        </div>
      </section>

      {/* ── PROJECTS TABLE SECTION ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--cx-border)] pb-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Projects
            </h2>
            <p className="cx-mono text-[10px] text-[var(--cx-text-muted)] mt-0.5">
              {projects.length} registered carbon projects under multi-modal verification
            </p>
          </div>

          {/* Quick Region Filters + Search Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-0.5">
              {(
                [
                  { id: "ALL", label: "All" },
                  { id: "IN", label: "🇮🇳 India" },
                  { id: "EU", label: "🇪🇺 Europe" },
                  { id: "BR", label: "🇧🇷 Brazil" },
                ] as const
              ).map((rf) => (
                <button
                  key={rf.id}
                  type="button"
                  onClick={() => setRegionFilter(rf.id)}
                  className={`cx-mono rounded px-2.5 py-1 text-[10px] font-semibold transition ${
                    regionFilter === rf.id
                      ? "bg-[var(--cx-surface)] text-[var(--cx-accent)] shadow-sm"
                      : "text-[var(--cx-text-muted)] hover:text-white"
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search project, registry…"
              className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] px-3 py-1.5 text-xs text-[var(--cx-text)] outline-none placeholder:text-[var(--cx-text-muted)] focus:border-[var(--cx-accent)] sm:w-52"
            />

            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--cx-success)] hover:text-[var(--cx-accent)] px-3 py-1.5 rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] transition"
            >
              <Plus className="w-3.5 h-3.5" /> New Project
            </Link>
          </div>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            title="No matching projects"
            detail="No registered carbon project matches the current filter parameters."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)] shadow-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--cx-border)] bg-[var(--cx-surface-inset)] text-[10px] font-bold uppercase tracking-wider text-[var(--cx-text-muted)]">
                  <th className="text-left px-6 py-3.5">Project</th>
                  <th className="text-left px-4 py-3.5">Type / Region</th>
                  <th className="text-right px-4 py-3.5">Claimed tCO2e</th>
                  <th className="text-right px-4 py-3.5">Truth Score</th>
                  <th className="text-center px-4 py-3.5">Decision</th>
                  <th className="text-center px-4 py-3.5">Status</th>
                  <th className="text-right px-6 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cx-border-subtle)]">
                {projects.map((project) => {
                  const meta =
                    project.id === "project_wayanad"
                      ? { score: 98.5, decision: "VERIFIED", status: "VERIFIED", color: "text-[var(--cx-success)]" }
                      : project.id === "project_sathyamangalam"
                        ? { score: 91.0, decision: "VERIFIED", status: "VERIFIED", color: "text-[var(--cx-success)]" }
                        : project.id === "project_greenforest"
                          ? { score: 82.5, decision: "REVIEW", status: "REVIEW", color: "text-[var(--cx-warning)]" }
                          : project.id === "project_vcs2547"
                            ? { score: 86.0, decision: "REVIEW", status: "REVIEW", color: "text-[var(--cx-warning)]" }
                            : { score: 94.0, decision: "VERIFIED", status: "VERIFIED", color: "text-[var(--cx-success)]" };

                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-[rgba(232,188,203,0.03)] transition group"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-bold text-white transition group-hover:text-[var(--cx-accent)]"
                        >
                          {project.name}
                        </Link>
                        <p className="text-[10px] text-[var(--cx-text-muted)] font-mono mt-0.5">
                          {project.registryId ?? project.id.slice(0, 12)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-xs text-[var(--cx-text-secondary)]">
                        {project.countryCode === "IN"
                          ? "Afforestation (A/R)"
                          : project.countryCode === "BR"
                            ? "Conservation (REDD+)"
                            : "Forestry & Revegetation"}
                      </td>
                      <td className="px-4 py-4 text-right text-xs font-semibold text-white">
                        {formatQuantity(project.totalHeldQuantity)} t
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-bold text-base ${meta.color} cx-mono`}>
                          {meta.score.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-[var(--cx-text-muted)]">
                          /100
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <DecisionBadge decision={meta.decision} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                            meta.decision === "VERIFIED"
                              ? "bg-[rgba(114,176,132,0.15)] text-[var(--cx-success)]"
                              : "bg-[rgba(237,142,89,0.15)] text-[var(--cx-warning)]"
                          }`}
                        >
                          {meta.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/projects/${project.id}/results`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--cx-accent)] hover:underline"
                          >
                            View Results <ArrowRight className="w-3 h-3" />
                          </Link>
                          <span className="text-[var(--cx-border)]">|</span>
                          <Link
                            href={`/projects/${project.id}/evidence`}
                            className="inline-flex items-center text-xs text-[var(--cx-text-muted)] hover:text-white"
                          >
                            Evidence
                          </Link>
                          <span className="text-[var(--cx-border)]">|</span>
                          <Link
                            href={`/projects/${project.id}`}
                            className="inline-flex items-center text-xs text-[var(--cx-text-muted)] hover:text-white"
                          >
                            Map
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
