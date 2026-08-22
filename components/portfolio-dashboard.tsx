"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  EmptyState,
  ErrorState,
  formatCurrency,
  formatQuantity,
  formatDate,
  LoadingState,
  MetricCard,
  Panel,
  PanelHeading,
  RiskBadge,
} from "./ui";
import {
  portfolioResponseSchema,
  type PortfolioResponse,
} from "../lib/validations/portfolio";

type SortKey = "name" | "totalHeldQuantity" | "activeIncidentCount" | "risk";

export function PortfolioDashboard() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("activeIncidentCount");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/portfolio", { cache: "no-store" });
      const envelope: unknown = await response.json();
      const body = envelope as { success?: unknown; data?: unknown };
      if (!response.ok || body.success !== true) {
        throw new Error("Portfolio read failed");
      }
      setData(portfolioResponseSchema.parse(body.data));
    } catch {
      setError("Portfolio data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const projects = useMemo(() => {
    if (!data) return [];
    const queryValue = query.trim().toLowerCase();
    const priority: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return data.projects
      .filter((project) => riskFilter === "ALL" || (project.risk ?? "UNASSESSED") === riskFilter)
      .filter((project) => !queryValue || `${project.name} ${project.registryId ?? ""} ${project.countryCode ?? ""}`.toLowerCase().includes(queryValue))
      .sort((left, right) => {
        if (sortKey === "name") return left.name.localeCompare(right.name);
        if (sortKey === "risk") return (priority[right.risk ?? ""] ?? 0) - (priority[left.risk ?? ""] ?? 0);
        return right[sortKey] - left[sortKey];
      });
  }, [data, query, riskFilter, sortKey]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? "Portfolio data unavailable."} onRetry={() => void load()} />;

  const distribution = data.riskDistribution;
  const maxRiskCount = Math.max(1, ...Object.values(distribution));

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-6 border-b border-white/10 pb-8 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/70"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Live portfolio read</div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{data.portfolio?.name ?? "Portfolio command center"}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">A decision-support view of carbon-credit exposure, environmental alerts, and evidence quality. Numeric values below are read from deterministic backend records.</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]" /> Supabase connected through server APIs</div>
      </header>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Projects monitored" value={formatQuantity(data.summary.totalProjects)} detail="Current portfolio scope" tone="green" />
        <MetricCard label="Held credits" value={formatQuantity(data.summary.totalHeldQuantity)} detail={`${formatQuantity(data.summary.holdingCount)} active holding records`} tone="blue" />
        <MetricCard label="Active incidents" value={formatQuantity(data.summary.activeIncidents)} detail="Unresolved incident records" tone={data.summary.activeIncidents ? "red" : "green"} />
        <MetricCard label="Financial exposure est." value={formatCurrency(data.summary.totalFinancialExposureEst)} detail="Assessment-derived; not a market price" tone={data.summary.totalFinancialExposureEst ? "amber" : "neutral"} />
      </section>

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <Panel>
          <PanelHeading eyebrow="Exposure posture" title="Risk distribution" detail="Active incidents by integrity risk" />
          <div className="space-y-5 px-5 py-6 sm:px-6">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNASSESSED"] as const).map((risk) => (
              <div key={risk} className="grid grid-cols-[90px_1fr_34px] items-center gap-3 text-xs">
                <span className="text-slate-400">{risk}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${risk === "CRITICAL" ? "bg-red-300" : risk === "HIGH" ? "bg-orange-300" : risk === "MEDIUM" ? "bg-amber-300" : risk === "LOW" ? "bg-emerald-300" : "bg-slate-500"}`} style={{ width: `${(distribution[risk] / maxRiskCount) * 100}%` }} /></div>
                <span className="text-right font-mono text-slate-300">{distribution[risk]}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeading eyebrow="Attention queue" title="Active incidents" detail="Open investigation records" />
          {data.activeIncidents.length === 0 ? <EmptyState title="No active incidents" detail="No unresolved incident has been persisted for this portfolio. New valid overlaps will appear here after event processing." /> : (
            <div className="divide-y divide-white/10">
              {data.activeIncidents.slice(0, 5).map((incident) => (
                <Link href={`/incidents/${incident.id}`} key={incident.id} className="block px-5 py-4 transition hover:bg-white/[0.04] sm:px-6">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-slate-200">{incident.projectName}</p><p className="mt-1 text-xs text-slate-500">{incident.eventType} · {formatDate(incident.createdAt)}</p></div><RiskBadge risk={incident.integrityRisk} /></div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel className="mt-7 overflow-hidden">
        <PanelHeading eyebrow="Portfolio inventory" title="Projects" detail={`${projects.length} of ${data.projects.length} projects shown`} />
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, registry, country" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-300/40 sm:max-w-sm" />
          <div className="flex flex-wrap gap-2">
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="rounded-lg border border-white/10 bg-[#0b1915] px-3 py-2.5 text-xs text-slate-300 outline-none"><option value="ALL">All risk states</option><option value="UNASSESSED">Unassessed</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="rounded-lg border border-white/10 bg-[#0b1915] px-3 py-2.5 text-xs text-slate-300 outline-none"><option value="activeIncidentCount">Sort: alerts</option><option value="risk">Sort: risk</option><option value="totalHeldQuantity">Sort: holdings</option><option value="name">Sort: name</option></select>
          </div>
        </div>
        {projects.length === 0 ? <EmptyState title="No projects match this view" detail="Clear the search or risk filter to inspect the portfolio inventory." /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-white/[0.025] text-[10px] uppercase tracking-[0.16em] text-slate-600"><tr><th className="px-5 py-3 font-semibold">Project</th><th className="px-5 py-3 font-semibold">Boundary</th><th className="px-5 py-3 font-semibold">Held credits</th><th className="px-5 py-3 font-semibold">Alerts</th><th className="px-5 py-3 font-semibold">Risk</th><th className="px-5 py-3 font-semibold">State</th></tr></thead><tbody className="divide-y divide-white/10">{projects.map((project) => <tr key={project.id} className="transition hover:bg-white/[0.03]"><td className="px-5 py-4"><Link href={`/projects/${project.id}`} className="group"><span className="block text-sm font-medium text-slate-200 group-hover:text-emerald-200">{project.name}</span><span className="mt-1 block text-xs text-slate-500">{project.registryId ?? "No registry reference"} {project.countryCode ? `· ${project.countryCode}` : ""}</span></Link></td><td className="px-5 py-4"><span className="text-xs text-slate-300">{project.boundaryQuality ?? "Unknown"}</span><span className="mt-1 block text-[11px] text-slate-600">{project.areaHa ? `${formatQuantity(project.areaHa)} ha` : "Area unavailable"}</span></td><td className="px-5 py-4 font-mono text-xs text-slate-300">{formatQuantity(project.totalHeldQuantity)}</td><td className="px-5 py-4 font-mono text-xs text-slate-300">{project.activeIncidentCount}</td><td className="px-5 py-4"><RiskBadge risk={project.risk} /></td><td className="px-5 py-4"><span className={`text-xs font-medium ${project.projectState === "CRITICAL" ? "text-red-200" : project.projectState === "WATCH" ? "text-amber-200" : project.projectState === "HEALTHY" ? "text-emerald-200" : "text-slate-400"}`}>{project.projectState}</span></td></tr>)}</tbody></table></div>}
      </Panel>
    </div>
  );
}
