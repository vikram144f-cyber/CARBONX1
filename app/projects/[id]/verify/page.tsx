"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Activity } from "@/components/icons";

interface PipelineEvent {
  stage: string;
  progress: number;
  message: string;
  time: string;
}

const STAGES = [
  { id: "PROJECT_RECORD", label: "Project record loaded" },
  { id: "GIS_ANALYSIS", label: "Registered GIS boundary inspected" },
  { id: "INVENTORY_RECONCILIATION", label: "CreditHolding inventory reconciled" },
  { id: "FIRMS_ANALYSIS", label: "NASA FIRMS evidence linkage checked" },
  { id: "TRUTH_SCORING", label: "Deterministic trust score calculated" },
  { id: "INTERPRETATION", label: "Narrative interpretation resolved" },
  { id: "COMPLETE", label: "Verification record ready" },
];

type ProjectEnvelope = {
  success?: boolean;
  data?: {
    name?: string;
    boundaries?: Array<{ areaHa?: number | null }>;
    holdingSummary?: { heldQuantity?: number };
  };
};

type TrustScoreEnvelope = {
  success?: boolean;
  data?: {
    truth_score: number;
    decision: string;
    anomalies: Array<{ type: string }>;
    model_version: string;
    gemini_report?: { ai_summary?: string };
  };
};

export default function LiveVerificationPage({
  params,
}: {
  params: { id: string };
}) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [projectName, setProjectName] = useState(params.id);
  const [projectArea, setProjectArea] = useState<number | null>(null);
  const [claimedCarbon, setClaimedCarbon] = useState<number | null>(null);
  const [score, setScore] = useState<TrustScoreEnvelope["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const addEvent = useCallback((stage: string, prog: number, message: string, index: number) => {
    setEvents((previous) => [
      { stage, progress: prog, message, time: new Date().toLocaleTimeString() },
      ...previous,
    ]);
    setCurrentStageIndex(index);
    setProgress(prog);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function runVerification() {
      setError(null);
      setComplete(false);
      setProgress(5);
      try {
        const projectResponse = await fetch(
          `/api/projects/${encodeURIComponent(params.id)}`,
          { cache: "no-store" },
        );
        const projectBody = (await projectResponse.json()) as ProjectEnvelope;
        if (!projectResponse.ok || projectBody.success !== true || !projectBody.data) {
          throw new Error("Project record could not be loaded");
        }

        if (cancelled) return;
        const project = projectBody.data;
        const area = project.boundaries?.[0]?.areaHa ?? null;
        const inventory = project.holdingSummary?.heldQuantity ?? null;
        setProjectName(project.name ?? params.id);
        setProjectArea(area);
        setClaimedCarbon(inventory);
        addEvent("PROJECT_RECORD", 22, `Loaded project record for ${project.name ?? params.id}.`, 0);
        addEvent(
          "GIS_ANALYSIS",
          42,
          area === null
            ? "No measured boundary area is available in the project record."
            : `Read the current boundary record (${area.toFixed(1)} ha).`,
          1,
        );
        addEvent(
          "INVENTORY_RECONCILIATION",
          58,
          inventory === null
            ? "No held credit inventory is available for comparison."
            : `Read ${inventory.toLocaleString()} held credits from the project record.`,
          2,
        );

        const scoreResponse = await fetch(
          `/api/projects/${encodeURIComponent(params.id)}/trust-score`,
          { cache: "no-store" },
        );
        const scoreBody = (await scoreResponse.json()) as TrustScoreEnvelope;
        if (!scoreResponse.ok || scoreBody.success !== true || !scoreBody.data) {
          throw new Error("Deterministic trust score could not be calculated");
        }

        if (cancelled) return;
        const result = scoreBody.data;
        setScore(result);
        addEvent(
          "FIRMS_ANALYSIS",
          72,
          result.anomalies.some((anomaly) => anomaly.type === "MISSING_ENVIRONMENTAL_EVIDENCE")
            ? "No NASA FIRMS event is linked; the absence is recorded as missing evidence."
            : "NASA FIRMS event linkage was included in the deterministic assessment.",
          3,
        );
        addEvent(
          "TRUTH_SCORING",
          88,
          `Calculated Trust Score ${result.truth_score.toFixed(1)}/100 · Decision: ${result.decision}.`,
          4,
        );
        addEvent(
          "INTERPRETATION",
          96,
          result.model_version.startsWith("deterministic-trust")
            ? "AI interpretation unavailable; deterministic assessment remains available."
            : `Narrative interpretation available from ${result.model_version}.`,
          5,
        );
        addEvent("COMPLETE", 100, "Verification record ready for review.", 6);
        setComplete(true);
      } catch (verificationError) {
        if (cancelled) return;
        setError(
          verificationError instanceof Error
            ? verificationError.message
            : "Verification could not be completed",
        );
      }
    }

    void runVerification();
    return () => {
      cancelled = true;
    };
  }, [addEvent, params.id]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--cx-accent)]">
              <Activity className="h-4 w-4" /> Evidence-backed verification
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Verification Review
            </h1>
            <p className="mt-1 font-mono text-xs text-[var(--cx-text-muted)]">
              Project: {projectName} ({params.id})
            </p>
          </div>

          <div className="space-y-5 rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)] p-6 shadow-xl">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs cx-mono">
                <span className="uppercase text-[var(--cx-text-secondary)]">Progress</span>
                <span className="font-bold text-[var(--cx-accent)]">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--cx-surface-inset)]">
                <div
                  className="h-full rounded-full bg-[var(--cx-accent)] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {STAGES.map((stage, index) => {
                const isCompleted = complete || index < currentStageIndex;
                const isCurrent = !complete && index === currentStageIndex;
                return (
                  <div key={stage.id} className="flex items-center gap-3 text-xs">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[var(--cx-success)]" />
                    ) : isCurrent ? (
                      <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-[var(--cx-accent)]" />
                    ) : (
                      <div className="h-5 w-5 flex-shrink-0 rounded-full border border-[var(--cx-border)] bg-[var(--cx-surface-inset)]" />
                    )}
                    <span className={`cx-mono ${isCompleted ? "font-medium text-white" : isCurrent ? "font-bold text-[var(--cx-accent)]" : "text-[var(--cx-text-muted)]"}`}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {error ? (
              <div className="rounded border border-[var(--cx-critical)]/40 bg-[var(--cx-critical)]/10 p-3 text-xs text-[var(--cx-critical)]">
                {error}. No synthetic verification result was created.
              </div>
            ) : null}

            {complete && score ? (
              <div className="flex items-center justify-between border-t border-[var(--cx-border-subtle)] pt-4 text-xs">
                <span className="cx-mono text-[var(--cx-text-muted)]">
                  {projectArea === null ? "Area unavailable" : `${projectArea.toFixed(1)} ha`} · {claimedCarbon === null ? "Inventory unavailable" : `${claimedCarbon.toLocaleString()} credits`}
                </span>
                <Link
                  href={`/projects/${encodeURIComponent(params.id)}/results`}
                  className="cx-mono rounded border border-[rgba(237,142,89,0.35)] bg-[rgba(237,142,89,0.12)] px-3 py-2 font-bold uppercase tracking-wider text-[var(--cx-accent)] transition hover:bg-[rgba(237,142,89,0.22)]"
                >
                  Review results →
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--cx-text-muted)]">
              Verification event log
            </h2>
            <span className="cx-mono flex items-center gap-1.5 text-[10px] text-[var(--cx-success)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--cx-success)]" />
              API-BACKED
            </span>
          </div>

          <div className="h-[460px] overflow-y-auto rounded-xl border border-[var(--cx-border)] bg-[#0c0a1a] p-4 font-mono text-xs shadow-inner">
            {events.length === 0 ? (
              <p className="text-[var(--cx-text-muted)]">Loading project evidence…</p>
            ) : (
              <div className="space-y-2.5">
                {events.map((event, index) => (
                  <div key={`${event.stage}-${index}`} className="space-y-1 rounded border border-[var(--cx-border-subtle)] bg-[rgba(255,255,255,0.02)] p-2.5">
                    <div className="flex items-center justify-between text-[10px] text-[var(--cx-text-muted)]">
                      <span className="font-bold text-[var(--cx-accent)]">[{event.stage}]</span>
                      <span>{event.time}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[var(--cx-text-secondary)]">{event.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
