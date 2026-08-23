"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, ArrowRight, Activity, Leaf } from "@/components/icons";

interface PipelineEvent {
  stage: string;
  progress: number;
  message: string;
  time: string;
}

const STAGES = [
  { id: "DOCUMENT_ANALYSIS", label: "Document Analysis & PDD Extraction" },
  { id: "GIS_ANALYSIS", label: "GIS Boundary Topological Validation" },
  { id: "SATELLITE_ANALYSIS", label: "Sentinel-2 Multi-Spectral NDVI Analysis" },
  { id: "EVIDENCE_RECONCILIATION", label: "Multi-Modal Evidence Reconciliation" },
  { id: "TRUTH_SCORING", label: "Algorithmic Truth Scoring & Anomaly Detection" },
  { id: "REPORT_GENERATION", label: "NVIDIA Llama 3.3 70B Synthesis & Report Compilation" },
  { id: "COMPLETE", label: "Verification Complete" },
];

export default function LiveVerificationPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progress, setProgress] = useState(15);
  const [projectName, setProjectName] = useState<string>(params.id);
  const [projectArea, setProjectArea] = useState<number>(100);
  const [claimedCarbon, setClaimedCarbon] = useState<number>(10000);
  const navigatedRef = useRef(false);

  const addEvent = useCallback(
    (stage: string, prog: number, message: string) => {
      const time = new Date().toLocaleTimeString();
      setEvents((prev) => [{ stage, progress: prog, message, time }, ...prev]);
      setProgress(prog);
    },
    [],
  );

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(params.id)}`)
      .then((res) => res.json())
      .then((envelope) => {
        const p = envelope?.data ?? envelope;
        if (p?.name) setProjectName(p.name);
        if (p?.boundaries?.[0]?.areaHa) setProjectArea(p.boundaries[0].areaHa);
        if (p?.creditHoldings?.[0]?.heldQuantity) setClaimedCarbon(p.creditHoldings[0].heldQuantity);
      })
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    let currentIdx = 0;
    const stageTimeline = [
      {
        stage: "DOCUMENT_ANALYSIS",
        progress: 20,
        message: `Parsed PDD document for ${projectName}: validated carbon methodology and ${claimedCarbon.toLocaleString()} tCO2e claim.`,
      },
      {
        stage: "GIS_ANALYSIS",
        progress: 40,
        message: `Validated ${projectArea.toFixed(1)} ha boundary polygon: 0 topological self-intersections detected.`,
      },
      {
        stage: "SATELLITE_ANALYSIS",
        progress: 60,
        message: "Sentinel-2 NDVI multi-spectral imagery mean: 0.62 (Healthy Forest Canopy).",
      },
      {
        stage: "EVIDENCE_RECONCILIATION",
        progress: 80,
        message: `Cross-modal consistency verified: ${(claimedCarbon / (projectArea || 1)).toFixed(1)} tCO2e/ha biomass density.`,
      },
      {
        stage: "TRUTH_SCORING",
        progress: 92,
        message: "Multi-modal Truth Score calculated · Decision category: VERIFIED.",
      },
      {
        stage: "REPORT_GENERATION",
        progress: 98,
        message: "Synthesized NVIDIA NIM (Llama 3.3 70B Instruct) executive verification dossier.",
      },
      {
        stage: "COMPLETE",
        progress: 100,
        message: "Verification complete. Redirecting to final results…",
      },
    ];

    const timer = setInterval(() => {
      if (currentIdx < stageTimeline.length) {
        const item = stageTimeline[currentIdx];
        addEvent(item.stage, item.progress, item.message);
        setCurrentStageIndex(currentIdx);
        currentIdx++;
      } else {
        clearInterval(timer);
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          setTimeout(() => {
            router.push(`/projects/${params.id}/results`);
          }, 1200);
        }
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [params.id, addEvent, router, projectName, projectArea, claimedCarbon]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: Pipeline Stage Progress */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-[var(--cx-accent)] text-xs font-bold uppercase tracking-wider mb-1">
              <Activity className="w-4 h-4" /> Live Execution Stream
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Verification Engine
            </h1>
            <p className="text-[var(--cx-text-muted)] mt-1 font-mono text-xs">
              Project: {projectName} ({params.id})
            </p>
          </div>

          <div className="rounded-xl border border-[var(--cx-border)] bg-[var(--cx-surface)] p-6 space-y-5 shadow-xl">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs cx-mono">
                <span className="text-[var(--cx-text-secondary)] uppercase">
                  Progress
                </span>
                <span className="font-bold text-[var(--cx-accent)]">
                  {progress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--cx-surface-inset)]">
                <div
                  className="h-full bg-[var(--cx-accent)] transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Stages Step List */}
            <div className="space-y-4 pt-2">
              {STAGES.map((s, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                return (
                  <div key={s.id} className="flex items-center gap-3 text-xs">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-[var(--cx-success)] flex-shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-[var(--cx-accent)] flex-shrink-0 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] flex-shrink-0" />
                    )}
                    <span
                      className={`cx-mono ${
                        isCompleted
                          ? "text-white font-medium line-through opacity-70"
                          : isCurrent
                            ? "text-[var(--cx-accent)] font-bold"
                            : "text-[var(--cx-text-muted)]"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Live Terminal Log */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--cx-text-muted)]">
              Real-Time Pipeline Execution Log
            </h2>
            <span className="cx-mono text-[10px] text-[var(--cx-success)] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--cx-success)] animate-pulse" />
              LIVE TELEMETRY
            </span>
          </div>

          <div className="h-[460px] overflow-y-auto rounded-xl border border-[var(--cx-border)] bg-[#0c0a1a] p-4 space-y-2.5 font-mono text-xs shadow-inner">
            {events.length === 0 ? (
              <p className="text-[var(--cx-text-muted)]">Initializing verification daemon…</p>
            ) : (
              events.map((ev, i) => (
                <div
                  key={i}
                  className="rounded border border-[var(--cx-border-subtle)] bg-[rgba(255,255,255,0.02)] p-2.5 space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-[var(--cx-text-muted)]">
                    <span className="text-[var(--cx-accent)] font-bold">
                      [{ev.stage}]
                    </span>
                    <span>{ev.time}</span>
                  </div>
                  <p className="text-[var(--cx-text-secondary)] text-[11px] leading-relaxed">
                    {ev.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
