"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { IncidentResponse } from "../lib/validations/incidents";
import { incidentResponseSchema } from "../lib/validations/incidents";
import { auditActionResponseSchema } from "../lib/validations/audit";
import { mapIncidentToSceneState } from "../features/investigation-3d/scene-state";
import { EvidenceBadge, EmptyState, ErrorState, formatCurrency, formatDate, formatPercent, LoadingState, MetricCard, Panel, PanelHeading, RiskBadge } from "./ui";

const Investigation3DOverlay = dynamic(
  () => import("../features/investigation-3d/overlay").then((module) => module.Investigation3DOverlay),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 z-50 grid place-items-center bg-[#04100c] text-sm text-slate-400">Loading investigation canvas…</div>,
  },
);

export function IncidentInvestigation({ incidentId }: { incidentId: string }) {
  const [data, setData] = useState<IncidentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditState, setAuditState] = useState<{
    status: "idle" | "submitting" | "success" | "error";
    message?: string;
  }>({ status: "idle" });
  const [show3D, setShow3D] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}`, { cache: "no-store" });
      const envelope: unknown = await response.json();
      const body = envelope as { success?: unknown; data?: unknown };
      if (!response.ok || body.success !== true) throw new Error(response.status === 404 ? "Incident not found." : "Incident read failed");
      setData(incidentResponseSchema.parse(body.data));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Incident data could not be loaded."); } finally { setLoading(false); }
  }, [incidentId]);
  useEffect(() => { void load(); }, [load]);
  const flagForAudit = useCallback(async () => {
    setAuditState({ status: "submitting", message: "Recording human audit recommendation…" });
    try {
      const response = await fetch(`/api/audits/${encodeURIComponent(incidentId)}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "FLAG_FOR_AUDIT", actor: "human:command-mode" }),
      });
      const envelope: unknown = await response.json();
      const body = envelope as {
        success?: unknown;
        data?: unknown;
        error?: { message?: unknown };
      };
      if (!response.ok || body.success !== true) {
        throw new Error(typeof body.error?.message === "string" ? body.error.message : "Audit recommendation failed");
      }
      auditActionResponseSchema.parse(body.data);
      setAuditState({ status: "success", message: "Audit recommendation recorded. Refreshing timeline…" });
      await load();
    } catch (caught) {
      setAuditState({ status: "error", message: caught instanceof Error ? caught.message : "Audit recommendation failed" });
    }
  }, [incidentId, load]);
  const timeline = useMemo(() => data ? [
    ...data.statusHistory.map((entry) => ({ id: `status-${entry.id}`, kind: "STATUS" as const, date: entry.createdAt, title: entry.toStatus.replaceAll("_", " "), detail: `${entry.fromStatus ? `${entry.fromStatus.replaceAll("_", " ")} → ` : ""}${entry.actor}`, label: entry.createdByType })),
    ...data.evidence.map((entry) => ({ id: `evidence-${entry.id}`, kind: "EVIDENCE" as const, date: entry.createdAt, title: `${entry.label} evidence`, detail: entry.notes ?? "Evidence record attached to this incident.", label: entry.createdByType })),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id)) : [], [data]);
  if (loading) return <LoadingState label="Loading investigation record" />;
  if (error || !data) return <ErrorState message={error ?? "Incident unavailable."} onRetry={() => void load()} />;

  const assessment = data.latestAssessment;

  return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
    {show3D ? <Investigation3DOverlay data={mapIncidentToSceneState(data)} onClose={() => setShow3D(false)} /> : null}
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500"><Link href="/" className="text-emerald-300/70 hover:text-emerald-200">Portfolio</Link><span>/</span><Link href={`/projects/${data.projectId}`} className="text-emerald-300/70 hover:text-emerald-200">{data.project.name}</Link><span>/</span><span>Incident {data.id}</span></div>
    <header className="mt-6 flex flex-col gap-5 border-b border-white/10 pb-8 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex flex-wrap items-center gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-200/80">Investigation center</span><span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">{data.status.replaceAll("_", " ")}</span></div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{data.event.type} at {data.project.name}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Observed by {data.event.sourceName} · acquired {formatDate(data.event.acquiredAt)} · source confidence {data.event.sourceConfidence === null ? "not recorded" : data.event.sourceConfidence.toFixed(2)}</p></div><div className="flex flex-col items-start gap-3 xl:items-end"><div className="flex flex-wrap items-center gap-3"><RiskBadge risk={assessment?.integrityRisk ?? null} />{data.project.currentBoundary ? <button type="button" onClick={() => setShow3D(true)} className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3.5 py-2.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/20">Investigate in 3D</button> : null}{data.status === "UNDER_ASSESSMENT" ? <button type="button" onClick={() => void flagForAudit()} disabled={auditState.status === "submitting"} className="inline-flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-300/10 px-3.5 py-2.5 text-xs font-semibold text-red-100 transition hover:border-red-200/50 hover:bg-red-300/20 disabled:cursor-wait disabled:opacity-70">{auditState.status === "submitting" ? <span className="h-3 w-3 animate-spin rounded-full border border-red-100/30 border-t-red-100" /> : null}{auditState.status === "submitting" ? "Recording…" : "Flag for Audit"}</button> : data.status === "AUDIT_RECOMMENDED" ? <span className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-200">Audit recommended</span> : null}</div>{auditState.message ? <p aria-live="polite" className={`max-w-xs text-right text-xs ${auditState.status === "error" ? "text-red-200" : auditState.status === "success" ? "text-emerald-200" : "text-slate-400"}`}>{auditState.message}</p> : null}</div></header>

    <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Physical impact" value={assessment?.estimatedImpactHa === null || !assessment ? "—" : `${assessment.estimatedImpactHa.toFixed(2)} ha`} detail={assessment ? "ESTIMATED buffered overlap" : "No deterministic assessment"} tone={assessment ? "amber" : "neutral"} /><MetricCard label="Impact share" value={formatPercent(assessment?.impactPct ?? null)} detail="Deterministic project-area ratio" tone="amber" /><MetricCard label="Credit exposure" value={assessment?.creditExposure === null || !assessment ? "—" : `${assessment.creditExposure.toFixed(2)} credits`} detail="Held quantity × impact share" tone="red" /><MetricCard label="Financial exposure" value={formatCurrency(assessment?.financialExposureEst ?? null, assessment?.financialCurrency ?? "USD")} detail="ESTIMATED reference valuation" tone="amber" /><MetricCard label="Evidence confidence" value={assessment?.evidenceConfidence ?? "—"} detail={assessment?.evidenceConfidenceScore === null || !assessment ? "Not assessed" : `Score ${assessment.evidenceConfidenceScore.toFixed(0)} / 100`} tone={assessment?.evidenceConfidence === "HIGH" ? "green" : "blue"} /></section>

    <div className="mt-7 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]"><Panel><PanelHeading eyebrow="Event provenance" title="Observed source context" detail="Source facts are distinct from calculated impact" /><div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6"><div><p className="cx-label">Source</p><p className="mt-2 text-sm text-slate-200">{data.event.sourceName}</p><p className="mt-1 text-xs text-slate-500">{data.event.sourceInstrument ?? "Instrument not recorded"}</p></div><div><p className="cx-label">Observation</p><p className="mt-2 text-sm text-slate-200">{formatDate(data.event.observedAt)}</p><p className="mt-1 text-xs text-slate-500">{data.event.originType} · {data.event.createdByType}</p></div><div><p className="cx-label">Boundary evidence</p><p className="mt-2 text-sm text-slate-200">{assessment ? <EvidenceBadge label={assessment.evidence[0]?.label ?? "ESTIMATED"} /> : "—"}</p><p className="mt-2 text-xs leading-5 text-slate-500">Buffered point detections are estimates and must not be read as exact burned area.</p></div><div><p className="cx-label">Audit priority</p><p className="mt-2 text-sm font-medium text-slate-200">{assessment?.auditPriority ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Deterministic risk and evidence matrix</p></div></div></Panel><Panel><PanelHeading eyebrow="Assessment provenance" title="Method and uncertainty" detail="All values originate from RiskAssessment" />{!assessment ? <EmptyState title="Assessment unavailable" detail="This incident has context but no persisted deterministic assessment yet." /> : <div className="space-y-5 px-5 py-6 sm:px-6"><div className="grid gap-4 sm:grid-cols-2"><div><p className="cx-label">Engine version</p><p className="mt-2 font-mono text-xs text-slate-300">{assessment.engineVersion}</p></div><div><p className="cx-label">Methodology</p><p className="mt-2 font-mono text-xs text-slate-300">{assessment.methodologyVersion}</p></div></div><div><p className="cx-label">Uncertainty disclosure</p><p className="mt-2 text-sm leading-6 text-slate-300">{assessment.uncertaintyNotes ?? "No uncertainty note recorded."}</p></div><div><p className="cx-label">Created by</p><p className="mt-2 text-xs text-slate-400">{assessment.createdByType} · {formatDate(assessment.createdAt)}</p></div></div>}</Panel></div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]"><Panel><PanelHeading eyebrow="AI interpretation" title="Narrative assessment" detail="AI is interpretive, never authoritative" />{!assessment?.aiReport ? <EmptyState title="Interpretation Unavailable" detail="No valid AI report is attached. Deterministic assessment data and audit workflow remain available." /> : <div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6">{([["Facts", assessment.aiReport.facts], ["Estimated impacts", assessment.aiReport.estimatedImpacts], ["Uncertainties", assessment.aiReport.uncertainties], ["Portfolio consequences", assessment.aiReport.portfolioConsequences], ["Recommendations", assessment.aiReport.recommendations]] as const).map(([title, text]) => <div key={title} className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/70">{title}</p><p className="mt-3 text-sm leading-6 text-slate-300">{text}</p></div>)}</div>}</Panel><Panel><PanelHeading eyebrow="Evidence commitments" title="Blockchain anchors" detail="Cryptographic evidence state" />{data.anchors.length === 0 ? <EmptyState title="No anchor records" detail="Blockchain anchoring is asynchronous and does not block incident investigation." /> : <div className="divide-y divide-white/10">{data.anchors.map((anchor) => <div key={anchor.id} className="px-5 py-5 sm:px-6"><div className="flex items-center justify-between gap-4"><p className="text-sm font-medium text-slate-200">{anchor.eventType.replaceAll("_", " ")}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${anchor.status === "CONFIRMED" ? "bg-emerald-300/10 text-emerald-200" : anchor.status === "FAILED" ? "bg-red-300/10 text-red-200" : "bg-amber-300/10 text-amber-200"}`}>{anchor.status}</span></div><p className="mt-3 break-all font-mono text-[11px] text-slate-500">{anchor.txHash ?? anchor.failureReason ?? "Awaiting transaction submission"}</p><p className="mt-2 text-xs text-slate-600">{anchor.network} · {formatDate(anchor.confirmedAt ?? anchor.createdAt)}</p></div>)}</div>}</Panel></div>

    <Panel className="mt-5"><PanelHeading eyebrow="Evidence timeline" title="Ordered incident record" detail={`${timeline.length} timeline entries`} />{timeline.length === 0 ? <EmptyState title="No timeline entries" detail="No status or evidence records are attached to this incident." /> : <div className="divide-y divide-white/10">{timeline.map((entry) => <div key={entry.id} className="flex gap-4 px-5 py-5 sm:px-6"><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${entry.kind === "STATUS" ? "bg-emerald-300" : "bg-blue-300"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-slate-200">{entry.title}</p><time className="text-[11px] text-slate-600">{formatDate(entry.date)}</time></div><p className="mt-2 text-xs leading-5 text-slate-400">{entry.detail}</p><p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">{entry.label}</p></div></div>)}</div>}</Panel>
  </div>;
}
