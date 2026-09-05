"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";

import type { ProjectMarkerItem } from "./satellite-map";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Leaf,
  MapIcon,
  Plus,
  RefreshCw,
  FileText,
  ShieldCheck,
} from "./icons";
import {
  EmptyState,
  ErrorState,
  formatCurrency,
  formatDate,
  formatQuantity,
  LoadingState,
  RiskBadge,
} from "./ui";
import {
  portfolioResponseSchema,
  type PortfolioResponse,
} from "../lib/validations/portfolio";

const SatelliteMap = dynamic(
  () => import("./satellite-map").then((module) => module.SatelliteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] w-full items-center justify-center rounded-[1.25rem] border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] text-xs text-[var(--cx-text-muted)]">
        <div className="flex items-center gap-2 cx-mono">
          <span className="h-2 w-2 animate-spin rounded-full border border-[var(--cx-accent)] border-t-transparent" />
          <span>Loading project map…</span>
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

const RISK_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNASSESSED"] as const;
const REGION_FILTERS = [
  { id: "ALL", label: "All regions" },
  { id: "IN", label: "India" },
  { id: "EU", label: "Europe" },
  { id: "BR", label: "Brazil" },
] as const;

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const toneClasses = {
    blue: "border-[#5c7cff]/25 bg-[#1b2e71]/75 text-[#8fa8ff]",
    green: "border-[#48d7ae]/25 bg-[#123e4a]/75 text-[#63e8c4]",
    amber: "border-[#ed8e59]/25 bg-[#3d2a36]/75 text-[#f4b08a]",
    red: "border-[#e56b78]/25 bg-[#40243d]/75 text-[#ff9eaa]",
  };

  return (
    <article className={`cx-portfolio-kpi ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="cx-label text-[9px] text-[#a9b9e9]">{label}</p>
          <p className="cx-mono mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
            {value}
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08]">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-[11px] leading-4 text-[#9eadd7]">{detail}</p>
    </article>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`cx-portfolio-panel ${className}`}>{children}</section>;
}

function PanelHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-5 sm:px-6">
      <div>
        <p className="cx-eyebrow text-[#8fa8ff]">{eyebrow}</p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-white">{title}</h2>
        {detail ? <p className="mt-1 text-xs text-[#91a0cc]">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

function riskRingBackground(distribution: PortfolioResponse["riskDistribution"]) {
  const total = RISK_LEVELS.reduce((sum, level) => sum + distribution[level], 0);
  if (!total) return "conic-gradient(#25366e 0deg 360deg)";

  const colors: Record<(typeof RISK_LEVELS)[number], string> = {
    CRITICAL: "#e56b78",
    HIGH: "#f5ad7a",
    MEDIUM: "#ed8e59",
    LOW: "#48d7ae",
    UNASSESSED: "#334579",
  };
  let cursor = 0;
  const stops = RISK_LEVELS.map((level) => {
    const start = cursor;
    cursor += (distribution[level] / total) * 360;
    return `${colors[level]} ${start}deg ${cursor}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function RiskRing({ distribution }: { distribution: PortfolioResponse["riskDistribution"] }) {
  const total = RISK_LEVELS.reduce((sum, level) => sum + distribution[level], 0);
  return (
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center rounded-full" style={{ background: riskRingBackground(distribution) }} aria-label={`${total} projects represented in risk distribution`}>
      <div className="flex h-[calc(100%-24px)] w-[calc(100%-24px)] flex-col items-center justify-center rounded-full border border-white/[0.08] bg-[#111b48] text-center">
        <span className="cx-mono text-3xl font-semibold text-white">{total}</span>
        <span className="cx-label mt-1 text-[8px] text-[#94a5d7]">projects</span>
      </div>
    </div>
  );
}

function RiskLegend({ distribution }: { distribution: PortfolioResponse["riskDistribution"] }) {
  const colors: Record<(typeof RISK_LEVELS)[number], string> = {
    CRITICAL: "bg-[#e56b78]",
    HIGH: "bg-[#f5ad7a]",
    MEDIUM: "bg-[#ed8e59]",
    LOW: "bg-[#48d7ae]",
    UNASSESSED: "bg-[#52639d]",
  };
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {RISK_LEVELS.map((level) => (
        <div key={level} className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-2 text-[#aab8e0]"><span className={`h-2 w-2 rounded-full ${colors[level]}`} />{level === "UNASSESSED" ? "Awaiting assessment" : level}</span>
          <span className="cx-mono font-semibold text-white">{distribution[level]}</span>
        </div>
      ))}
    </div>
  );
}

function StatePill({ state }: { state: PortfolioResponse["projects"][number]["projectState"] }) {
  const styles = {
    HEALTHY: "border-[#48d7ae]/25 bg-[#48d7ae]/10 text-[#63e8c4]",
    WATCH: "border-[#ed8e59]/25 bg-[#ed8e59]/10 text-[#f4b08a]",
    CRITICAL: "border-[#e56b78]/25 bg-[#e56b78]/10 text-[#ff9eaa]",
    UNASSESSED: "border-white/10 bg-white/[0.05] text-[#aebbe1]",
  };
  return <span className={`cx-mono inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-wider ${styles[state]}`}>{state === "UNASSESSED" ? "AWAITING ASSESSMENT" : state}</span>;
}

export function PortfolioDashboard() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [ingestionStats, setIngestionStats] = useState<{ fetched: number; inserted: number; skippedDuplicates: number; status: string; reason?: string } | null>(null);
  const [, startTransition] = useTransition();

  const loadData = () => {
    setLoading(true);
    fetch("/api/portfolio", { cache: "no-store" })
      .then((res) => res.json())
      .then((envelope) => {
        const parsed = portfolioResponseSchema.safeParse(envelope?.data ?? envelope);
        if (parsed.success) { setData(parsed.data); setError(null); }
        else { console.error("[PortfolioDashboard] Zod parse failure", parsed.error); setError("Data validation failed for portfolio record."); }
      })
      .catch((caught) => { console.error("[PortfolioDashboard] fetch error", caught); setError("Unable to connect to carbon intelligence server."); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "carbonx-dev-refresh" }) });
      const json = await response.json();
      if (json.success && json.data) {
        setIngestionStats({ fetched: json.data.fetchedCount ?? 0, inserted: json.data.insertedCount ?? 0, skippedDuplicates: json.data.skippedDuplicates ?? 0, status: json.data.status ?? "COMPLETED", reason: json.data.reason });
        startTransition(() => loadData());
      } else setIngestionStats({ fetched: 0, inserted: 0, skippedDuplicates: 0, status: "UNAVAILABLE", reason: "Environmental sync is unavailable." });
    } catch (caught) {
      console.error("[PortfolioDashboard] refresh failed", caught);
      setIngestionStats({ fetched: 0, inserted: 0, skippedDuplicates: 0, status: "UNAVAILABLE", reason: "Environmental sync is unavailable." });
    } finally { setRefreshing(false); }
  };

  if (loading && !data) return <LoadingState label="Loading monitored carbon assets" />;
  if (error || !data) return <div className="mx-auto max-w-5xl px-5 py-12"><ErrorState message={error ?? "Portfolio unavailable."} onRetry={loadData} /></div>;

  const projects = data.projects.filter((project) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = normalizedQuery === "" || project.name.toLowerCase().includes(normalizedQuery) || (project.registryId?.toLowerCase().includes(normalizedQuery) ?? false) || (project.countryCode?.toLowerCase().includes(normalizedQuery) ?? false);
    const matchesRisk = riskFilter === "ALL" || (riskFilter === "UNASSESSED" && project.risk === null) || project.risk === riskFilter;
    const matchesRegion = regionFilter === "ALL" || (regionFilter === "IN" && project.countryCode === "IN") || (regionFilter === "EU" && (project.countryCode === "RO" || project.countryCode === "AL")) || (regionFilter === "BR" && project.countryCode === "BR");
    return matchesQuery && matchesRisk && matchesRegion;
  });
  const projectMarkers: ProjectMarkerItem[] = data.projects.map((project) => { const [centroidLng, centroidLat] = PROJECT_CENTROIDS[project.id] ?? [0, 0]; return { id: project.id, name: project.name, centroidLng, centroidLat, countryCode: project.countryCode, registryId: project.registryId, areaHa: project.areaHa, heldQuantity: project.totalHeldQuantity, risk: project.risk }; });
  const assessedProjects = data.projects.filter((project) => project.latestAssessmentAt !== null).length;
  const coverage = data.summary.totalProjects ? Math.round((assessedProjects / data.summary.totalProjects) * 100) : 0;
  const activeIncidents = data.activeIncidents.slice(0, 4);

  return (
    <div className="cx-portfolio-shell">
      <div className="cx-portfolio-orb cx-portfolio-orb-one" /><div className="cx-portfolio-orb cx-portfolio-orb-two" />
      <div className="relative mx-auto max-w-[1540px] space-y-5 px-4 py-5 sm:space-y-6 sm:px-7 sm:py-8 lg:px-9">
        
        {/* Telemetry Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#101b44]/80 px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#48d7ae] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#48d7ae]" />
            </span>
            <span className="cx-mono text-[10px] font-bold tracking-wider text-white">
              CARBONX COMMAND TELEMETRY
            </span>
            <span className="text-[10px] text-[var(--cx-text-muted)]">·</span>
            <span className="cx-mono text-[10px] text-[#8fa8ff]">
              MULTI-MODAL ENGINE ONLINE
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] cx-mono text-[#8fa8ff]">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-[#48d7ae]" /> AI INTERPRETATION OPTIONAL</span>
            <span className="hidden sm:inline text-[var(--cx-border)]">|</span>
            <span className="hidden sm:inline">NASA FIRMS MONITORING READY</span>
            <span className="hidden sm:inline text-[var(--cx-border)]">|</span>
            <span className="hidden sm:inline">NASA FIRMS SOURCE</span>
          </div>
        </div>

        <header className="flex flex-col gap-6 rounded-[1.5rem] border border-white/[0.1] bg-[#172866]/75 px-5 py-6 shadow-[0_28px_90px_rgba(5,10,42,0.38)] backdrop-blur-xl sm:px-8 sm:py-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="cx-eyebrow flex items-center gap-2 text-[#93aaff]">
              <Leaf className="h-3.5 w-3.5" /> CarbonX Spatial Intelligence Station
            </p>
            <h1 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
              Global Carbon Asset Command
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#aebbe1] sm:text-[15px]">
              Deterministic trust scoring, NASA FIRMS thermal-alert ingestion, and GIS boundary reconciliation across global credit portfolios.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/projects/new" className="cx-portfolio-button cx-portfolio-button-primary">
              <Plus className="h-4 w-4" /> Submit New Project
            </Link>
            <Link href="/documents" className="cx-portfolio-button cx-portfolio-button-secondary">
              <FileText className="h-4 w-4" /> Documents Archive
            </Link>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Held inventory" value={`${formatQuantity(data.summary.totalHeldQuantity)} t`} detail={`${data.summary.holdingCount} holding records`} icon={<Database className="h-4 w-4" />} />
          <MetricCard label="Active incidents" value={formatQuantity(data.summary.activeIncidents)} detail="Open records requiring attention" icon={<AlertTriangle className="h-4 w-4" />} tone={data.summary.activeIncidents ? "red" : "green"} />
          <MetricCard label="Projects monitored" value={formatQuantity(data.summary.totalProjects)} detail={`${coverage}% with a persisted assessment`} icon={<MapIcon className="h-4 w-4" />} />
          <MetricCard label="Financial exposure" value={formatCurrency(data.summary.totalFinancialExposureEst)} detail={`${formatQuantity(data.summary.totalCreditExposure)} t estimated exposure`} icon={<Activity className="h-4 w-4" />} tone={data.summary.totalFinancialExposureEst ? "amber" : "green"} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_.95fr]">
          <Panel className="relative min-h-[260px] overflow-hidden">
            <div className="cx-portfolio-panel-glow" />
            <div className="relative flex h-full flex-col justify-between gap-8 p-6 sm:p-8">
              <div>
                <p className="cx-eyebrow text-[#8fa8ff]">Workspace overview</p>
                <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Multi-Modal Truth Verification
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#aab7df]">
                  Reconciles GIS polygons, NASA FIRMS thermal detections, and deterministic carbon-density calculations.
                </p>
              </div>
              <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.08] bg-black/10 p-3">
                  <p className="cx-label text-[8px] text-[#8fa8ff]">Projects</p>
                  <p className="cx-mono mt-2 text-lg font-semibold text-white">{data.summary.totalProjects}</p>
                  <p className="mt-1 text-[11px] text-[#93a1ca]">registered</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-black/10 p-3">
                  <p className="cx-label text-[8px] text-[#8fa8ff]">Boundary quality</p>
                  <p className="cx-mono mt-2 text-lg font-semibold text-white">{data.projects.filter((project) => project.boundaryQuality === "HIGH").length}</p>
                  <p className="mt-1 text-[11px] text-[#93a1ca]">high quality records</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-black/10 p-3">
                  <p className="cx-label text-[8px] text-[#8fa8ff]">Incidents</p>
                  <p className="cx-mono mt-2 text-lg font-semibold text-white">{data.summary.activeIncidents}</p>
                  <p className="mt-1 text-[11px] text-[#93a1ca]">active now</p>
                </div>
              </div>
            </div>
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Portfolio posture" title="Risk distribution" detail="Current project-level assessments" />
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
              <RiskRing distribution={data.riskDistribution} />
              <div className="min-w-0 flex-1">
                <RiskLegend distribution={data.riskDistribution} />
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.45fr_.75fr]">
          <Panel className="overflow-hidden">
            <PanelHeader eyebrow="Project locations" title="Portfolio map" detail={`${data.projects.length} records from the Portfolio API`} action={<span className="cx-badge-provenance border-[#5c7cff]/25 bg-[#5c7cff]/10 text-[#a8b7ff]">WGS84 / project records</span>} />
            <div className="p-3 sm:p-4">
              <SatelliteMap centroid={[20, 25]} zoom={3} projectMarkers={projectMarkers} showQuickJump height="420px" className="rounded-[1rem]" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2 text-xs text-[#98a7d2]">
                <span className="h-2 w-2 rounded-full bg-[#48d7ae]" /> Real project records and current assessment fields
              </div>
              <button type="button" onClick={() => void handleRefresh()} disabled={refreshing} className="cx-portfolio-button cx-portfolio-button-compact">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Syncing…" : "Refresh environmental data"}
              </button>
            </div>
            {ingestionStats ? (
              <p className={`border-t border-white/[0.08] px-5 py-3 text-[11px] ${ingestionStats.status === "COMPLETED" ? "text-[#63e8c4]" : "text-[#f4b08a]"}`}>
                {ingestionStats.status === "COMPLETED" ? `${ingestionStats.fetched} observations fetched · ${ingestionStats.inserted} new · ${ingestionStats.skippedDuplicates} duplicates skipped` : ingestionStats.reason}
              </p>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Operational signal" title="Active incidents" detail="No automatic conclusions" />
            <div className="p-5 sm:p-6">
              {activeIncidents.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#48d7ae]/20 bg-[#48d7ae]/10 text-[#63e8c4]">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-white">No active incidents</p>
                  <p className="mt-2 max-w-xs text-xs leading-5 text-[#94a4d1]">The portfolio currently has no open incident records requiring investigation.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeIncidents.map((incident) => (
                    <Link key={incident.id} href={`/incidents/${incident.id}`} className="block rounded-xl border border-white/[0.08] bg-black/10 p-4 hover:border-[#8298ff]/40 hover:bg-white/[0.04]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{incident.projectName}</p>
                          <p className="mt-1 text-[11px] text-[#93a2cc]">{incident.eventType} · {incident.status}</p>
                        </div>
                        <RiskBadge risk={incident.integrityRisk} />
                      </div>
                      <div className="mt-4 flex items-center justify-between text-[11px] text-[#93a2cc]">
                        <span>{incident.auditPriority ?? "Priority pending"}</span>
                        <span className="inline-flex items-center gap-1 text-[#a8b7ff]">Open <ArrowRight className="h-3 w-3" /></span>
                      </div>
                    </Link>
                  ))}
                  {data.activeIncidents.length > activeIncidents.length ? (
                    <p className="pt-2 text-center text-[11px] text-[#93a2cc]">Showing {activeIncidents.length} of {data.activeIncidents.length} active incidents.</p>
                  ) : null}
                </div>
              )}
            </div>
          </Panel>
        </section>

        {/* Portfolio Projects Table */}
        <section className="cx-portfolio-panel overflow-hidden">
          <div className="flex flex-col gap-5 border-b border-white/[0.08] px-5 py-5 lg:flex-row lg:items-end lg:justify-between sm:px-6">
            <div>
              <p className="cx-eyebrow text-[#8fa8ff]">Portfolio register</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Monitored Carbon Projects</h2>
              <p className="mt-1 text-xs text-[#91a0cc]">{projects.length} of {data.projects.length} registered project records shown</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.08] bg-black/10 p-1">
                {REGION_FILTERS.map((filter) => (
                  <button key={filter.id} type="button" onClick={() => setRegionFilter(filter.id)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition ${regionFilter === filter.id ? "bg-[#5c7cff]/20 text-[#b7c4ff]" : "text-[#91a0cc] hover:text-white"}`}>
                    {filter.label}
                  </button>
                ))}
              </div>
              <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} aria-label="Filter by risk" className="cx-portfolio-control">
                <option value="ALL">All risk levels</option>
                <option value="UNASSESSED">Awaiting assessment</option>
                <option value="LOW">Low risk</option>
                <option value="MEDIUM">Medium risk</option>
                <option value="HIGH">High risk</option>
                <option value="CRITICAL">Critical risk</option>
              </select>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects…" aria-label="Search projects" className="cx-portfolio-control min-w-[180px]" />
              <Link href="/projects/new" className="cx-portfolio-button cx-portfolio-button-compact">
                <Plus className="h-3.5 w-3.5" /> New project
              </Link>
            </div>
          </div>

          {projects.length === 0 ? (
            <EmptyState title="No matching projects" detail="No registered project matches the current filter parameters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="cx-portfolio-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Region & Provenance</th>
                    <th className="text-right">Held inventory</th>
                    <th>Integrity Risk</th>
                    <th>Portfolio state</th>
                    <th>Verification Dossier</th>
                    <th className="text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-white/[0.03] transition group">
                      <td>
                        <Link href={`/projects/${project.id}`} className="font-semibold text-white hover:text-[#b7c4ff] transition">
                          {project.name}
                        </Link>
                        <p className="cx-mono mt-1 text-[10px] text-[#7484b5]">{project.registryId ?? project.id}</p>
                      </td>
                      <td>
                        <span className="text-xs text-[#aebbe1]">{project.countryCode ?? "—"}</span>
                        <p className="mt-1 text-[10px] text-[#7484b5]">{project.boundaryQuality ? `Boundary ${project.boundaryQuality.toLowerCase()}` : "Boundary quality unavailable"}</p>
                      </td>
                      <td className="text-right">
                        <span className="cx-mono text-sm font-semibold text-white">{formatQuantity(project.totalHeldQuantity)}</span>
                        <span className="ml-1 text-[10px] text-[#7484b5]">t</span>
                        <p className="mt-1 text-[10px] text-[#7484b5]">{project.holdingCount} holding{project.holdingCount === 1 ? "" : "s"}</p>
                      </td>
                      <td><RiskBadge risk={project.risk} /></td>
                      <td><StatePill state={project.projectState} /></td>
                      <td>
                        <Link
                          href={`/projects/${project.id}/results`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#ed8e59]/30 bg-[#ed8e59]/10 text-xs font-semibold text-[#f4b08a] hover:bg-[#ed8e59]/20 transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Truth Score →</span>
                        </Link>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/projects/${project.id}/evidence`}
                            className="cx-mono text-[10px] px-2 py-1 rounded border border-white/10 bg-white/5 text-[#aebbe1] hover:text-white hover:border-[#5c7cff]/40 transition"
                          >
                            Evidence
                          </Link>
                          <Link
                            href={`/projects/${project.id}`}
                            className="cx-mono text-[10px] px-2 py-1 rounded border border-[#5c7cff]/30 bg-[#5c7cff]/10 text-[#a8b7ff] hover:bg-[#5c7cff]/20 transition inline-flex items-center gap-1"
                          >
                            <span>Spatial</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
