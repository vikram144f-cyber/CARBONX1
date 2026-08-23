"use client";

import { useEffect, useState } from "react";
import type { TrustScoreResult, ScoreComponent } from "../lib/services/trust-score";
import { Panel } from "./ui";

const DECISION_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  VERIFIED: {
    color: "text-[var(--cx-success)]",
    bg: "bg-[rgba(114,176,132,0.12)]",
    border: "border-[rgba(114,176,132,0.3)]",
    label: "VERIFIED",
  },
  REVIEW: {
    color: "text-[var(--cx-warning)]",
    bg: "bg-[rgba(237,142,89,0.12)]",
    border: "border-[rgba(237,142,89,0.3)]",
    label: "HUMAN REVIEW",
  },
  HIGH_RISK: {
    color: "text-[#f5ad7a]",
    bg: "bg-[rgba(245,173,122,0.12)]",
    border: "border-[rgba(245,173,122,0.3)]",
    label: "HIGH RISK",
  },
  INVALID: {
    color: "text-[var(--cx-critical)]",
    bg: "bg-[rgba(229,107,120,0.12)]",
    border: "border-[rgba(229,107,120,0.3)]",
    label: "INVALID CLAIM",
  },
};

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "border-red-500/40 bg-red-500/10 text-red-300",
  HIGH: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  MEDIUM: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  LOW: "border-slate-500/40 bg-slate-500/10 text-slate-300",
};

function ScoreBar({ component }: { component: ScoreComponent }) {
  const pct =
    component.weight > 0
      ? (component.weighted_score / component.weight) * 100
      : 0;

  const barColor =
    pct >= 80
      ? "bg-[var(--cx-success)]"
      : pct >= 50
        ? "bg-[var(--cx-warning)]"
        : "bg-[var(--cx-critical)]";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between cx-mono text-xs">
        <span className="text-[var(--cx-text-secondary)]">
          {component.name ?? component.component_name.replace(/_/g, " ")}
        </span>
        <span className="font-semibold text-white">
          {component.weighted_score.toFixed(1)} / {component.weight.toFixed(0)}{" "}
          <span className="text-[10px] text-[var(--cx-text-muted)]">
            ({Math.round(pct)}%)
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--cx-surface-inset)]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      {component.reason ? (
        <p className="text-[10px] text-[var(--cx-text-muted)]">
          {component.reason}
        </p>
      ) : null}
    </div>
  );
}

export function TrustScoreCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<TrustScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"scores" | "evidence" | "anomalies">("scores");

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(projectId)}/trust-score`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((body) => {
        if (body.success && body.data) setData(body.data);
      })
      .catch((err) => console.error("Trust score fetch failed", err))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <Panel className="p-6 text-center text-xs text-[var(--cx-text-muted)]">
        <div className="flex items-center justify-center gap-2 cx-mono">
          <span className="h-2 w-2 animate-spin rounded-full border border-[var(--cx-accent)] border-t-transparent" />
          <span>EVALUATING MULTI-MODAL EVIDENCE & TRUTH SCORE…</span>
        </div>
      </Panel>
    );
  }

  if (!data) return null;

  const score = Math.round(data.truth_score);
  const dc = DECISION_CONFIG[data.decision] ?? DECISION_CONFIG.REVIEW;

  return (
    <Panel className="mt-8 overflow-hidden">
      {/* Header */}
      <div className="border-b border-[var(--cx-border)] px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="cx-eyebrow">AI TRUTH & EVIDENCE VERIFICATION</span>
              <span className="text-[var(--cx-border)]">/</span>
              <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                MULTI-MODAL ENGINE
              </span>
            </div>
            <h2 className="mt-1 text-base font-semibold text-white">
              Carbon Project Truth Score & Verification Dossier
            </h2>
          </div>

          {/* Navigation Sub-tabs */}
          <div className="flex items-center gap-1.5 cx-mono text-[10px]">
            {(
              [
                { id: "scores", label: "SCORE COMPONENTS" },
                { id: "evidence", label: "EVIDENCE GRAPH" },
                { id: "anomalies", label: `ANOMALIES (${data.anomalies.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded border px-2.5 py-1 uppercase tracking-wider transition ${
                  activeTab === tab.id
                    ? "border-[var(--cx-accent)] bg-[rgba(237,142,89,0.12)] text-[var(--cx-accent)]"
                    : "border-transparent text-[var(--cx-text-muted)] hover:border-[var(--cx-border)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {/* Main Grid: Score Gauge + Active Tab Content */}
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Circular Truth Score Gauge */}
          <div className="flex flex-col items-center justify-center rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-6 text-center">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-[rgba(232,188,203,0.15)] bg-[var(--cx-surface)] shadow-inner">
              <div className="text-center">
                <span className="cx-mono block text-4xl font-bold tracking-tighter text-white">
                  {score}
                </span>
                <span className="cx-mono text-[9px] uppercase tracking-widest text-[var(--cx-text-muted)]">
                  / 100
                </span>
              </div>
            </div>

            <div
              className={`mt-4 inline-flex items-center gap-1.5 rounded border px-3 py-1 text-xs font-semibold ${dc.color} ${dc.bg} ${dc.border}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {dc.label}
            </div>

            <p className="cx-mono mt-3 text-[10px] text-[var(--cx-text-muted)]">
              Evidence coverage confidence: {(data.confidence * 100).toFixed(0)}%
            </p>
          </div>

          {/* Right Side: Tab View */}
          <div>
            {activeTab === "scores" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.score_components.map((comp) => (
                    <ScoreBar key={comp.component_name} component={comp} />
                  ))}
                </div>

                {/* AI Summary Banner */}
                <div className="mt-4 rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-4 text-xs">
                  <span className="cx-eyebrow block text-[9px]">
                    {data.model_version.startsWith("google/")
                      ? `${data.model_version.replace("google/", "").toUpperCase()} SYNTHESIS`
                      : "DETERMINISTIC SCORE / AI NARRATIVE UNAVAILABLE"}
                  </span>
                  <p className="mt-1 text-[var(--cx-text-secondary)] leading-relaxed">
                    {data.gemini_report.ai_summary}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "evidence" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.evidence.map((node) => (
                    <div
                      key={node.id}
                      className="rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="cx-badge-provenance">
                          {node.source_type}
                        </span>
                        <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                          Conf: {(node.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="mt-1.5 font-semibold text-white">
                        {node.metric.replace(/_/g, " ")}:{" "}
                        <span className="text-[var(--cx-accent)]">
                          {typeof node.value === "number"
                            ? node.value.toLocaleString()
                            : String(node.value)}{" "}
                          {node.unit ?? ""}
                        </span>
                      </p>
                      <p className="mt-1 truncate cx-mono text-[10px] text-[var(--cx-text-muted)]">
                        Source: {node.source_name}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-4 text-xs">
                  <span className="cx-eyebrow block text-[9px]">
                    CROSS-MODAL RECONCILIATION
                  </span>
                  {data.relationships.map((rel, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs text-[var(--cx-text-secondary)]"
                    >
                      <span
                        className={`cx-mono mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                          rel.type === "CONSISTENT_WITH" || rel.type === "SUPPORTS"
                            ? "bg-[rgba(114,176,132,0.15)] text-[var(--cx-success)]"
                            : "bg-[rgba(229,107,120,0.15)] text-[var(--cx-critical)]"
                        }`}
                      >
                        {rel.type}
                      </span>
                      <span>{rel.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "anomalies" && (
              <div className="space-y-3">
                {data.anomalies.length === 0 ? (
                  <div className="rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-6 text-center text-xs text-[var(--cx-text-muted)]">
                    <span className="cx-mono text-[var(--cx-success)]">
                      ✓ NO CRITICAL OR HIGH SEVERITY ANOMALIES DETECTED
                    </span>
                    <p className="mt-1">
                      Stored claims, boundary provenance, and any linked FIRMS observations are evaluated within deterministic threshold bounds.
                    </p>
                  </div>
                ) : (
                  data.anomalies.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-3 text-xs"
                    >
                      <span
                        className={`cx-mono rounded border px-2 py-0.5 text-[9px] font-bold ${
                          SEVERITY_STYLE[anomaly.severity] ?? SEVERITY_STYLE.LOW
                        }`}
                      >
                        {anomaly.severity}
                      </span>
                      <div>
                        <p className="font-semibold text-white">
                          {anomaly.type.replace(/_/g, " ")}
                        </p>
                        <p className="mt-0.5 text-[var(--cx-text-secondary)]">
                          {anomaly.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
