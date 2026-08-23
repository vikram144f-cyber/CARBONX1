"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchPortfolioData } from "../lib/client/portfolio";
import {
  EmptyState,
  ErrorState,
  formatCurrency,
  formatQuantity,
  formatDate,
  LoadingState,
  Panel,
  RiskBadge,
} from "./ui";
import type { PortfolioResponse } from "../lib/validations/portfolio";
import type { SatelliteMapProps } from "./satellite-map";

const SatelliteMap = dynamic(
  () => import("./satellite-map").then((m) => m.SatelliteMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] text-xs text-[var(--cx-text-muted)]"
        style={{ height: 420 }}
      >
        <span className="cx-mono uppercase tracking-wider text-[11px]">
          Loading geospatial overview…
        </span>
      </div>
    ),
  },
) as React.ComponentType<SatelliteMapProps>;

type SortKey = "name" | "totalHeldQuantity" | "activeIncidentCount" | "risk";

type IngestionStats = {
  status: string;
  fetched?: number;
  inserted?: number;
  skippedDuplicates?: number;
  rejected?: number;
  reason?: string;
};

// Default centroid for overview map (Rotunda Forest & Balkan Region)
const OVERVIEW_CENTROID: [number, number] = [21.5, 43.0];

export function PortfolioDashboard({
  focus,
  initialData,
}: {
  focus?: string;
  initialData?: PortfolioResponse | null;
}) {
  const [data, setData] = useState<PortfolioResponse | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("activeIncidentCount");
  const [refreshing, setRefreshing] = useState(false);
  const [ingestionStats, setIngestionStats] = useState<IngestionStats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchPortfolioData());
    } catch {
      setError("Portfolio data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) void load();
  }, [initialData, load]);

  useEffect(() => {
    if (!focus || loading) return;
    document
      .getElementById(focus === "projects" ? "project-monitoring-grid" : "incident-attention-queue")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus, loading]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setIngestionStats(null);
    try {
      const response = await fetch("/api/admin/refresh", {
        method: "POST",
        headers: { authorization: "Bearer carbonx-dev-refresh" },
      });
      const body = (await response.json()) as {
        success?: boolean;
        data?: IngestionStats;
      };
      if (!body.success || !body.data) {
        throw new Error("Ingestion pipeline returned an error");
      }
      setIngestionStats(body.data);
      await load();
    } catch (err) {
      setIngestionStats({
        status: "FAILED",
        reason: err instanceof Error ? err.message : "Sync failed",
      });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const projects = useMemo(() => {
    if (!data) return [];
    const queryValue = query.trim().toLowerCase();
    const priority: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };
    return data.projects
      .filter(
        (project) =>
          riskFilter === "ALL" || (project.risk ?? "UNASSESSED") === riskFilter,
      )
      .filter(
        (project) =>
          !queryValue ||
          `${project.name} ${project.registryId ?? ""} ${project.countryCode ?? ""}`
            .toLowerCase()
            .includes(queryValue),
      )
      .sort((left, right) => {
        if (sortKey === "name") return left.name.localeCompare(right.name);
        if (sortKey === "risk")
          return (
            (priority[right.risk ?? ""] ?? 0) - (priority[left.risk ?? ""] ?? 0)
          );
        return right[sortKey] - left[sortKey];
      });
  }, [data, query, riskFilter, sortKey]);

  if (loading) return <LoadingState label="Synchronizing portfolio state" />;
  if (error || !data)
    return (
      <ErrorState
        message={error ?? "Portfolio telemetry unavailable."}
        onRetry={() => void load()}
      />
    );

  const distribution = data.riskDistribution;

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 sm:py-8">
      {/* ── Editorial Header & Station Title ────────────────────────────── */}
      <header className="border-b border-[var(--cx-border)] pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="cx-eyebrow">PORTFOLIO MONITORING STATION</span>
              <span className="text-[var(--cx-border)]">/</span>
              <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                {data.portfolio?.name ?? "Global Carbon Assets"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-medium tracking-tight text-white sm:text-3xl">
              Geospatial Carbon Intelligence
            </h1>
          </div>

          {/* Inline Telemetry Bar */}
          <div className="flex flex-wrap items-center gap-6 border-t border-[var(--cx-border-subtle)] pt-3 lg:border-t-0 lg:pt-0">
            <div>
              <span className="cx-label block text-[9px]">Monitored Scope</span>
              <span className="cx-mono text-sm font-semibold text-white">
                {formatQuantity(data.summary.totalProjects)} Projects
              </span>
            </div>
            <div>
              <span className="cx-label block text-[9px]">Held Volume</span>
              <span className="cx-mono text-sm font-semibold text-white">
                {formatQuantity(data.summary.totalHeldQuantity)} Credits
              </span>
            </div>
            <div>
              <span className="cx-label block text-[9px]">Active Incidents</span>
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
              <span className="cx-label block text-[9px]">Financial Exposure</span>
              <span className="cx-mono text-sm font-semibold text-[var(--cx-warning)]">
                {formatCurrency(data.summary.totalFinancialExposureEst)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── PRIMARY HERO: Large Geospatial Overview ─────────────────────── */}
      <section className="mt-6">
        <div className="relative">
          {/* Top Bar for Map context */}
          <div className="flex items-center justify-between border-x border-t border-[var(--cx-border)] bg-[var(--cx-surface)] px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--cx-accent)] animate-pulse" />
              <span className="cx-mono text-[10px] uppercase tracking-wider text-[var(--cx-text)]">
                Live Satellite Telemetry · Romania & Albania Centroids
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-[var(--cx-text-muted)]">
              <span className="cx-mono hidden sm:inline">
                BASAL TILES: ESRI WORLD IMAGERY
              </span>
            </div>
          </div>

          <SatelliteMap
            centroid={OVERVIEW_CENTROID}
            zoom={6}
            height="460px"
            className="rounded-t-none"
          />

          {/* Integrated Data Freshness & Ingestion Control Strip */}
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
                {refreshing ? "Querying FIRMS…" : "Refresh Environmental Data"}
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
                  NASA VIIRS/MODIS active
                </span>
              )}
            </div>

            <div className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
              DETERMINISTIC BUFFER: 5.0 KM · TURF.JS RISK MATRIX
            </div>
          </div>
        </div>
      </section>

      {/* ── SECONDARY AREA: Asymmetric Layout ───────────────────────────── */}
      <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main Column: Monitored Projects Table */}
        <div id="project-monitoring-grid">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--cx-border)] pb-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">
                Monitored Project Directory
              </h2>
              <p className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                {projects.length} of {data.projects.length} project boundaries registered
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search registry, country, name…"
                className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] px-3 py-1.5 text-xs text-[var(--cx-text)] outline-none placeholder:text-[var(--cx-text-muted)] focus:border-[var(--cx-accent)] sm:w-56"
              />
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] px-2.5 py-1.5 text-xs text-[var(--cx-text)] outline-none"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
                <option value="UNASSESSED">Unassessed</option>
              </select>
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
                    <th>Project</th>
                    <th>Region / Registry</th>
                    <th>Boundary Quality</th>
                    <th>Held Quantity</th>
                    <th>Alerts</th>
                    <th>Risk State</th>
                    <th className="text-right">AI Trust Score</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
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
                        {project.boundaryQuality ?? "Unknown"}{" "}
                        <span className="text-[var(--cx-text-muted)]">
                          {project.areaHa
                            ? `(${formatQuantity(project.areaHa)} ha)`
                            : ""}
                        </span>
                      </td>
                      <td className="cx-mono text-xs text-right font-medium">
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
                        <Link
                          href={`/projects/${project.id}/results`}
                          className="cx-mono inline-flex items-center gap-1 rounded border border-[rgba(237,142,89,0.35)] bg-[rgba(237,142,89,0.12)] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[var(--cx-accent)] transition hover:bg-[rgba(237,142,89,0.22)]"
                        >
                          <span>AI TRUST SCORE</span>
                          <span>→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}

                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Side Column: Risk Posture & Incident Attention Queue */}
        <div id="incident-attention-queue" className="space-y-6">
          {/* Risk Distribution Breakdown */}
          <Panel>
            <div className="border-b border-[var(--cx-border)] px-4 py-3">
              <span className="cx-eyebrow">INTEGRITY POSTURE</span>
              <h3 className="text-xs font-semibold text-white">Risk Distribution</h3>
            </div>
            <div className="space-y-2.5 p-4 text-xs">
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNASSESSED"] as const).map(
                (risk) => (
                  <div
                    key={risk}
                    className="flex items-center justify-between cx-mono text-[11px]"
                  >
                    <span className="flex items-center gap-2 text-[var(--cx-text-muted)]">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          risk === "CRITICAL"
                            ? "bg-[var(--cx-critical)]"
                            : risk === "HIGH"
                              ? "bg-[var(--cx-warning)]"
                              : risk === "MEDIUM"
                                ? "bg-[var(--cx-info)]"
                                : risk === "LOW"
                                  ? "bg-[var(--cx-success)]"
                                  : "bg-[var(--cx-text-muted)]"
                        }`}
                      />
                      {risk}
                    </span>
                    <span className="font-semibold text-[var(--cx-text)]">
                      {distribution[risk]}
                    </span>
                  </div>
                ),
              )}
            </div>
          </Panel>

          {/* Active Incidents List */}
          <Panel>
            <div className="border-b border-[var(--cx-border)] px-4 py-3">
              <span className="cx-eyebrow">ATTENTION QUEUE</span>
              <h3 className="text-xs font-semibold text-white">
                Active Incident Records
              </h3>
            </div>
            {data.activeIncidents.length === 0 ? (
              <EmptyState
                title="No active incidents"
                detail="No unresolved environmental alerts exist for monitored projects."
              />
            ) : (
              <div className="divide-y divide-[var(--cx-border-subtle)]">
                {data.activeIncidents.slice(0, 5).map((incident) => (
                  <Link
                    href={`/incidents/${incident.id}`}
                    key={incident.id}
                    className="block p-4 transition hover:bg-[var(--cx-surface-subtle)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-[var(--cx-text)]">
                          {incident.projectName}
                        </p>
                        <p className="cx-mono mt-1 text-[10px] text-[var(--cx-text-muted)]">
                          {incident.eventType} · {formatDate(incident.createdAt)}
                        </p>
                      </div>
                      <RiskBadge risk={incident.integrityRisk} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}
