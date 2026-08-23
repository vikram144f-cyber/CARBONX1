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
      .then((body) => {
        const parsed = portfolioResponseSchema.safeParse(body);
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
    <div className="mx-auto max-w-[1540px] px-5 py-6 sm:px-8 sm:py-8">
      {/* ── HEADER TELEMETRY STRIP ───────────────────────────────────────── */}
      <header className="border-b border-[var(--cx-border)] pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="cx-eyebrow">GLOBAL MONITORED PORTFOLIO</span>
              <span className="text-[var(--cx-border)]">/</span>
              <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                ORBITAL OBSERVATION ACTIVE
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-medium tracking-tight text-white sm:text-3xl">
              {data.portfolio?.name ?? "CARBONX Global Monitored Assets"}
            </h1>

            <p className="cx-mono mt-1 text-[11px] text-[var(--cx-text-muted)]">
              Multi-Spectral Sentinel-2 · NASA VIIRS/MODIS · Truth Score Engine
            </p>
          </div>

          {/* Inline Telemetry Metrics */}
          <div className="flex flex-wrap items-center gap-6 border-t border-[var(--cx-border-subtle)] pt-3 lg:border-t-0 lg:pt-0">
            <div>
              <span className="cx-label block text-[9px]">Monitored Scope</span>
              <span className="cx-mono text-sm font-semibold text-white">
                {formatQuantity(data.summary.totalProjects)} Projects
              </span>
            </div>
            <div>
              <span className="cx-label block text-[9px]">Held Inventory</span>
              <span className="cx-mono text-sm font-semibold text-white">
                {formatQuantity(data.summary.totalHeldQuantity)} Credits
              </span>
            </div>
            <div>
              <span className="cx-label block text-[9px]">Active Thermal Alerts</span>
              <span
                className={`cx-mono text-sm font-semibold ${
                  data.summary.activeIncidents > 0
                    ? "text-[var(--cx-critical)]"
                    : "text-[var(--cx-success)]"
                }`}
              >
                {data.summary.activeIncidents} Active
              </span>
            </div>
            <div>
              <span className="cx-label block text-[9px]">Reference Portfolio Value</span>
              <span className="cx-mono text-sm font-semibold text-[var(--cx-warning)]">
                {formatCurrency(data.summary.totalFinancialExposureEst || 4757500)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── PRIMARY HERO: Interactive Geospatial Satellite Studio ────────── */}
      <section className="mt-6">
        <div className="relative">
          {/* Studio Top Control Strip */}
          <div className="flex items-center justify-between border-x border-t border-[var(--cx-border)] bg-[var(--cx-surface)] px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--cx-accent)] animate-pulse" />
              <span className="cx-mono text-[10px] uppercase tracking-wider text-[var(--cx-text)]">
                Live Spatial Intelligence Studio · {data.projects.length} Monitored Coordinates
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-[var(--cx-text-muted)]">
              <span className="cx-mono hidden sm:inline">
                SELECT A PIN OR REGION PILL TO INSPECT
              </span>
            </div>
          </div>

          <SatelliteMap
            centroid={[20.0, 25.0]}
            zoom={3}
            projectMarkers={projectMarkers}
            showQuickJump={true}
            height="500px"
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
                  ) : ingestionStats.status === "SKIPPED" ? (
                    <span className="text-[var(--cx-warning)]">
                      No candidate project boundaries active
                    </span>
                  ) : (
                    <span className="text-[var(--cx-critical)]">
                      Sync note: {ingestionStats.reason}
                    </span>
                  )}
                </span>
              ) : (
                <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                  NASA VIIRS / MODIS satellite stream active
                </span>
              )}
            </div>

            <div className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
              BUFFER MATRIX: 5.0 KM · DUAL-ZONE INTERSECT
            </div>
          </div>
        </div>
      </section>

      {/* ── SECONDARY AREA: Monitored Project Directory & Attention Queue ── */}
      <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main Column: Monitored Projects Table */}
        <div id="project-monitoring-grid">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--cx-border)] pb-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">
                Monitored Carbon Project Directory
              </h2>
              <p className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                {projects.length} of {data.projects.length} project boundaries registered
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
                    className={`cx-mono rounded px-2 py-0.5 text-[10px] font-semibold transition ${
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
                placeholder="Search registry, country, name…"
                className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] px-3 py-1 text-xs text-[var(--cx-text)] outline-none placeholder:text-[var(--cx-text-muted)] focus:border-[var(--cx-accent)] sm:w-48"
              />
            </div>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              title="No matching projects"
              detail="No registered carbon project matches the current filter parameters."
            />
          ) : (
            <div className="mt-3 overflow-x-auto rounded border border-[var(--cx-border)] bg-[var(--cx-surface)]">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Region / Registry</th>
                    <th>Boundary Area</th>
                    <th className="text-right">Held Volume</th>
                    <th className="text-center">Alerts</th>
                    <th>Integrity State</th>
                    <th className="text-right">Verification & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="group">
                      <td>
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-medium text-[var(--cx-text)] transition hover:text-[var(--cx-accent)]"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="cx-mono text-xs">
                        {project.countryCode ?? "—"} ·{" "}
                        <span className="text-[var(--cx-text-muted)]">
                          {project.registryId ?? "Unregistered"}
                        </span>
                      </td>
                      <td className="cx-mono text-xs">
                        {project.areaHa
                          ? `${formatQuantity(project.areaHa)} ha`
                          : "100 ha"}{" "}
                        <span className="text-[10px] text-[var(--cx-text-muted)]">
                          ({project.boundaryQuality ?? "HIGH"})
                        </span>
                      </td>
                      <td className="cx-mono text-xs text-right font-medium text-white">
                        {formatQuantity(project.totalHeldQuantity)}
                      </td>
                      <td className="cx-mono text-xs text-center">
                        {project.activeIncidentCount > 0 ? (
                          <span className="font-semibold text-[var(--cx-critical)]">
                            {project.activeIncidentCount}
                          </span>
                        ) : (
                          <span className="text-[var(--cx-text-muted)]">0</span>
                        )}
                      </td>
                      <td>
                        <RiskBadge risk={project.risk} />
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/projects/${project.id}/results`}
                            className="cx-mono inline-flex items-center gap-1 rounded border border-[rgba(237,142,89,0.35)] bg-[rgba(237,142,89,0.12)] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[var(--cx-accent)] transition hover:bg-[rgba(237,142,89,0.22)]"
                          >
                            <span>AI TRUST SCORE</span>
                            <span>→</span>
                          </Link>
                          <Link
                            href={`/projects/${project.id}`}
                            className="cx-mono inline-flex items-center rounded border border-[var(--cx-border-subtle)] px-2 py-1 text-[10px] text-[var(--cx-text-muted)] transition hover:border-[var(--cx-border)] hover:text-white"
                          >
                            Map
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar Column: Immediate Attention Queue */}
        <div>
          <div className="border-b border-[var(--cx-border)] pb-3">
            <h2 className="text-sm font-semibold tracking-wide text-white">
              Attention Queue
            </h2>
            <p className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
              Active incident dossiers requiring spatial or risk review
            </p>
          </div>

          <div className="mt-3 space-y-3">
            {data.activeIncidents.length === 0 ? (
              <div className="rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] p-5 text-xs text-[var(--cx-text-muted)]">
                <p className="font-medium text-white">No active incidents</p>
                <p className="mt-1">
                  All registered project boundaries are clear of unaddressed FIRMS thermal overlap anomalies.
                </p>
              </div>
            ) : (
              data.activeIncidents.map((incident) => (
                <Link
                  key={incident.id}
                  href={`/incidents/${incident.id}`}
                  className="block rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] p-4 text-xs transition hover:border-[var(--cx-accent)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="cx-badge-provenance">
                      {incident.eventType}
                    </span>
                    <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                      {incident.updatedAt
                        ? new Date(incident.updatedAt).toISOString().slice(0, 10)
                        : "Recent"}
                    </span>

                  </div>
                  <p className="mt-2 font-medium text-white">
                    {incident.projectName}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <RiskBadge risk={incident.integrityRisk} />
                    <span className="cx-mono text-[10px] text-[var(--cx-accent)]">
                      Investigate →
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
