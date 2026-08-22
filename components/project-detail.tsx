"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EmptyState, ErrorState, formatCurrency, formatDate, formatQuantity, LoadingState, MetricCard, Panel, PanelHeading, RiskBadge } from "./ui";
import { projectResponseSchema, type ProjectResponse } from "../lib/validations/portfolio";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const envelope: unknown = await response.json();
      const body = envelope as { success?: unknown; data?: unknown };
      if (!response.ok || body.success !== true) throw new Error("Project read failed");
      setData(projectResponseSchema.parse(body.data));
    } catch { setError("Project data could not be loaded."); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <LoadingState label="Loading project record" />;
  if (error || !data) return <ErrorState message={error ?? "Project unavailable."} onRetry={() => void load()} />;
  const activeIncidents = data.incidents.filter((incident) => incident.status !== "RESOLVED");

  return <div className="mx-auto max-w-[1400px] px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
    <Link href="/" className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/70 hover:text-emerald-200">← Back to portfolio</Link>
    <header className="mt-6 flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Project detail · {data.registryId ?? "unregistered"}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{data.name}</h1><p className="mt-3 text-sm text-slate-400">{data.countryCode ?? "Country not recorded"} · {data.methodology ?? "Methodology not recorded"} · centroid {data.centroidLat.toFixed(4)}, {data.centroidLng.toFixed(4)}</p></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-200">{activeIncidents.length ? `${activeIncidents.length} active incident${activeIncidents.length === 1 ? "" : "s"}` : "No active incidents"}</span></header>
    <section className="mt-7 grid gap-3 sm:grid-cols-3"><MetricCard label="Held credits" value={formatQuantity(data.holdingSummary.heldQuantity)} detail={`${formatQuantity(data.holdingSummary.holdingCount)} holding records`} tone="blue" /><MetricCard label="Reference value" value={formatCurrency(data.holdingSummary.referenceValue)} detail="Holding reference values only" tone="amber" /><MetricCard label="Boundaries" value={formatQuantity(data.boundaries.length)} detail="Versioned provenance records" tone="green" /></section>
    <section className="mt-7 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]"><Panel><PanelHeading eyebrow="Boundary provenance" title="Current and historical boundaries" detail="Source metadata, not a burned-area claim" />{data.boundaries.length === 0 ? <EmptyState title="No boundary records" detail="This project has no persisted boundary version." /> : <div className="divide-y divide-white/10">{data.boundaries.map((boundary) => <div key={boundary.id} className="px-5 py-5 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-200">Version {boundary.version} {boundary.isCurrent ? <span className="ml-2 text-[10px] uppercase tracking-[0.15em] text-emerald-300">Current</span> : null}</p><p className="mt-1 text-xs text-slate-500">Quality {boundary.quality} · {boundary.areaHa ? `${formatQuantity(boundary.areaHa)} ha` : "area unavailable"}</p></div><span className="text-xs text-slate-500">Verified {formatDate(boundary.verifiedAt)}</span></div><p className="mt-4 text-xs leading-5 text-slate-400">{boundary.source}</p>{boundary.sourceUrl ? <a href={boundary.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs text-emerald-300/80 hover:text-emerald-200">{boundary.sourceUrl}</a> : null}</div>)}</div>}</Panel><Panel><PanelHeading eyebrow="Holdings" title="Credit inventory" detail="No client-side exposure calculations" />{data.holdings.length === 0 ? <EmptyState title="No holdings recorded" detail="Credit exposure cannot be inferred without persisted CreditHolding records." /> : <div className="divide-y divide-white/10">{data.holdings.map((holding) => <div key={holding.id} className="px-5 py-4 sm:px-6"><div className="flex items-center justify-between gap-4"><span className="text-sm text-slate-300">{holding.registrySerialRef ?? "No serial reference"}</span><span className="text-xs text-slate-500">{holding.status}</span></div><p className="mt-2 font-mono text-xs text-slate-400">{formatQuantity(holding.heldQuantity)} held · {formatCurrency(holding.refValuePerUnit, holding.refCurrency)} / unit</p></div>)}</div>}</Panel></section>
    <Panel className="mt-7"><PanelHeading eyebrow="Investigation queue" title="Incident history" detail="Read-only project context" />{data.incidents.length === 0 ? <EmptyState title="No incidents for this project" detail="Environmental events are not incidents until a valid project overlap is processed." /> : <div className="divide-y divide-white/10">{data.incidents.map((incident) => <Link href={`/incidents/${incident.id}`} key={incident.id} className="flex flex-col gap-3 px-5 py-5 transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="text-sm font-medium text-slate-200">{incident.eventType} event</p><p className="mt-1 text-xs text-slate-500">{incident.status} · opened {formatDate(incident.createdAt)}</p></div><div className="flex items-center gap-4"><RiskBadge risk={incident.integrityRisk} /><span className="text-xs text-emerald-300">Open investigation →</span></div></Link>)}</div>}</Panel>
  </div>;
}
