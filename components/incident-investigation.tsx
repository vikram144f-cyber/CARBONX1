"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { IncidentResponse } from "../lib/validations/incidents";
import { incidentResponseSchema } from "../lib/validations/incidents";
import { auditActionResponseSchema } from "../lib/validations/audit";
import { mapIncidentToSceneState } from "../features/investigation-3d/scene-state";
import {
  EmptyState,
  ErrorState,
  EvidenceBadge,
  formatCurrency,
  formatDate,
  formatPercent,
  LoadingState,
  Panel,
  RiskBadge,
} from "./ui";
import type { FirmsPoint, GeoJsonFeature, SatelliteMapProps } from "./satellite-map";

const Investigation3DOverlay = dynamic(
  () =>
    import("../features/investigation-3d/overlay").then(
      (module) => module.Investigation3DOverlay,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070514] text-xs text-slate-400">
        <span className="cx-mono uppercase tracking-wider">
          Initializing 3D spatial canvas…
        </span>
      </div>
    ),
  },
);

const SatelliteMap = dynamic(
  () => import("./satellite-map").then((m) => m.SatelliteMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] text-xs text-[var(--cx-text-muted)]"
        style={{ height: 380 }}
      >
        <span className="cx-mono uppercase tracking-wider text-[11px]">
          Loading incident map…
        </span>
      </div>
    ),
  },
) as React.ComponentType<SatelliteMapProps>;

export function IncidentInvestigation({
  incidentId,
  autoOpen3D = false,
}: {
  incidentId: string;
  autoOpen3D?: boolean;
}) {
  const [data, setData] = useState<IncidentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditState, setAuditState] = useState<{
    status: "idle" | "submitting" | "success" | "error";
    message?: string;
  }>({ status: "idle" });
  const [show3D, setShow3D] = useState(false);
  const openedFromRoute = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/incidents/${encodeURIComponent(incidentId)}`,
        { cache: "no-store" },
      );
      const envelope: unknown = await response.json();
      const body = envelope as { success?: unknown; data?: unknown };
      if (!response.ok || body.success !== true)
        throw new Error(
          response.status === 404
            ? "Incident not found."
            : "Incident read failed",
        );
      setData(incidentResponseSchema.parse(body.data));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Incident record could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (autoOpen3D && data?.project.currentBoundary && !openedFromRoute.current) {
      openedFromRoute.current = true;
      setShow3D(true);
    }
  }, [autoOpen3D, data]);

  const flagForAudit = useCallback(async () => {
    setAuditState({
      status: "submitting",
      message: "Submitting human audit recommendation…",
    });
    try {
      const response = await fetch(
        `/api/audits/${encodeURIComponent(incidentId)}/actions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "FLAG_FOR_AUDIT",
            actor: "human:command-mode",
          }),
        },
      );
      const envelope: unknown = await response.json();
      const body = envelope as {
        success?: unknown;
        data?: unknown;
        error?: { message?: unknown };
      };
      if (!response.ok || body.success !== true) {
        throw new Error(
          typeof body.error?.message === "string"
            ? body.error.message
            : "Audit recommendation failed",
        );
      }
      auditActionResponseSchema.parse(body.data);
      setAuditState({
        status: "success",
        message: "Audit recommendation recorded in database.",
      });
      await load();
    } catch (caught) {
      setAuditState({
        status: "error",
        message:
          caught instanceof Error
            ? caught.message
            : "Audit recommendation failed",
      });
    }
  }, [incidentId, load]);

  const timeline = useMemo(
    () =>
      data
        ? [
            ...data.statusHistory.map((entry) => ({
              id: `status-${entry.id}`,
              kind: "STATUS" as const,
              date: entry.createdAt,
              title: entry.toStatus.replaceAll("_", " "),
              detail: `${
                entry.fromStatus
                  ? `${entry.fromStatus.replaceAll("_", " ")} → `
                  : ""
              }${entry.actor}`,
              label: entry.createdByType,
              reason: entry.reason,
            })),
            ...data.evidence.map((entry) => ({
              id: `evidence-${entry.id}`,
              kind: "EVIDENCE" as const,
              date: entry.createdAt,
              title: `${entry.label} Evidence`,
              detail:
                entry.notes ?? "Evidence record attached to this incident.",
              label: entry.createdByType,
              reason: null,
            })),
          ].sort(
            (left, right) =>
              left.date.localeCompare(right.date) ||
              left.id.localeCompare(right.id),
          )
        : [],
    [data],
  );

  if (loading) return <LoadingState label="Loading incident dossier" />;
  if (error || !data)
    return (
      <ErrorState
        message={error ?? "Incident unavailable."}
        onRetry={() => void load()}
      />
    );

  const assessment = data.latestAssessment;

  const eventGeomForCentroid = data.event.geometry as {
    type?: string;
    coordinates?: number[];
  } | null;
  const fallbackLng = eventGeomForCentroid?.coordinates?.[0] ?? 0;
  const fallbackLat = eventGeomForCentroid?.coordinates?.[1] ?? 0;
  const centroid: [number, number] = [
    data.project.centroidLng ?? fallbackLng,
    data.project.centroidLat ?? fallbackLat,
  ];

  const boundary: GeoJsonFeature | null = data.project.currentBoundary
    ? (data.project.currentBoundary.geojson as GeoJsonFeature)
    : null;

  const eventGeom = data.event.geometry as {
    type?: string;
    coordinates?: number[];
  } | null;
  const firmsPoints: FirmsPoint[] =
    eventGeom?.type === "Point" && Array.isArray(eventGeom.coordinates)
      ? [
          {
            id: data.event.id,
            longitude: eventGeom.coordinates[0],
            latitude: eventGeom.coordinates[1],
            sourceConfidence: data.event.sourceConfidence,
            observedAt: data.event.observedAt,
            sourceInstrument: data.event.sourceInstrument,
            sourceName: data.event.sourceName,
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 sm:py-8">
      {show3D ? (
        <Investigation3DOverlay
          data={mapIncidentToSceneState(data)}
          onClose={() => setShow3D(false)}
        />
      ) : null}

      {/* Navigation Breadcrumbs */}
      <div className="flex items-center gap-2 cx-mono text-[11px] text-[var(--cx-text-muted)]">
        <Link
          href="/?mode=command"
          className="transition hover:text-[var(--cx-accent)]"
        >
          PORTFOLIO
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${data.projectId}`}
          className="transition hover:text-[var(--cx-accent)]"
        >
          {data.project.name}
        </Link>
        <span>/</span>
        <span className="text-[var(--cx-text)]">
          INCIDENT-{data.id.slice(0, 8)}
        </span>
      </div>

      {/* Incident Header */}
      <header className="mt-3 border-b border-[var(--cx-border)] pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="cx-eyebrow">INCIDENT INVESTIGATION DOSSIER</span>
              <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                STATUS: {data.status.replaceAll("_", " ")}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-medium tracking-tight text-white sm:text-3xl">
              {data.event.type} Incident · {data.project.name}
            </h1>
            <p className="cx-mono mt-1 text-[11px] text-[var(--cx-text-muted)]">
              Observed by {data.event.sourceName}{" "}
              {data.event.sourceInstrument ? `(${data.event.sourceInstrument})` : ""} ·
              Acquired {formatDate(data.event.acquiredAt)}
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--cx-border-subtle)] pt-3 lg:border-t-0 lg:pt-0">
            <RiskBadge risk={assessment?.integrityRisk ?? null} />

            {data.project.currentBoundary ? (
              <button
                type="button"
                onClick={() => setShow3D(true)}
                className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--cx-accent)] transition hover:border-[var(--cx-accent)]"
              >
                3D Investigation →
              </button>
            ) : null}

            {data.status === "UNDER_ASSESSMENT" ? (
              <button
                type="button"
                onClick={() => void flagForAudit()}
                disabled={auditState.status === "submitting"}
                className="cx-mono rounded border border-[rgba(229,107,120,0.3)] bg-[rgba(229,107,120,0.12)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#e56b78] transition hover:bg-[rgba(229,107,120,0.2)] disabled:cursor-wait"
              >
                {auditState.status === "submitting" ? "Recording…" : "Flag for Audit"}
              </button>
            ) : data.status === "AUDIT_RECOMMENDED" ? (
              <span className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] px-3 py-2 text-xs font-medium text-[var(--cx-text-secondary)]">
                Audit Recommended
              </span>
            ) : null}
          </div>
        </div>

        {auditState.message ? (
          <p
            className={`cx-mono mt-2 text-xs ${
              auditState.status === "error"
                ? "text-[var(--cx-critical)]"
                : "text-[var(--cx-success)]"
            }`}
          >
            {auditState.message}
          </p>
        ) : null}
      </header>

      {/* ── Deterministic Metrics Strip ─────────────────────────────────── */}
      <section className="mt-6 grid grid-cols-2 gap-4 border-b border-[var(--cx-border)] pb-6 sm:grid-cols-5">
        <div>
          <span className="cx-label block text-[9px]">Physical Impact</span>
          <span className="cx-mono text-base font-semibold text-white">
            {assessment?.estimatedImpactHa !== null && assessment
              ? `${assessment.estimatedImpactHa.toFixed(2)} ha`
              : "—"}
          </span>
          <span className="cx-mono block text-[9px] text-[var(--cx-text-muted)]">
            ESTIMATED Overlap
          </span>
        </div>

        <div>
          <span className="cx-label block text-[9px]">Impact Share</span>
          <span className="cx-mono text-base font-semibold text-white">
            {formatPercent(assessment?.impactPct ?? null)}
          </span>
          <span className="cx-mono block text-[9px] text-[var(--cx-text-muted)]">
            Area Ratio
          </span>
        </div>

        <div>
          <span className="cx-label block text-[9px]">Credit Exposure</span>
          <span className="cx-mono text-base font-semibold text-[var(--cx-critical)]">
            {assessment?.creditExposure !== null && assessment
              ? `${assessment.creditExposure.toFixed(2)} credits`
              : "—"}
          </span>
          <span className="cx-mono block text-[9px] text-[var(--cx-text-muted)]">
            Held Volume × Share
          </span>
        </div>

        <div>
          <span className="cx-label block text-[9px]">Financial Exposure</span>
          <span className="cx-mono text-base font-semibold text-[var(--cx-warning)]">
            {formatCurrency(
              assessment?.financialExposureEst ?? null,
              assessment?.financialCurrency ?? "USD",
            )}
          </span>
          <span className="cx-mono block text-[9px] text-[var(--cx-text-muted)]">
            ESTIMATED Valuation
          </span>
        </div>

        <div>
          <span className="cx-label block text-[9px]">Evidence Confidence</span>
          <span className="cx-mono text-base font-semibold text-[var(--cx-text)]">
            {assessment?.evidenceConfidence ?? "—"}
          </span>
          <span className="cx-mono block text-[9px] text-[var(--cx-text-muted)]">
            Score: {assessment?.evidenceConfidenceScore?.toFixed(0) ?? "n/a"}/100
          </span>
        </div>
      </section>

      {/* ── WORKSPACE: Dual Column Split Layout ─────────────────────────── */}
      <section className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Left Column: Spatial & Evidentiary Base */}
        <div className="space-y-6">
          {/* Spatial Evidence Map */}
          <div>
            <div className="flex items-center justify-between border-x border-t border-[var(--cx-border)] bg-[var(--cx-surface)] px-4 py-2 text-xs">
              <span className="cx-mono text-[10px] uppercase tracking-wider text-[var(--cx-text)]">
                SPATIAL EVIDENCE · OVERLAP INSPECTION
              </span>
              <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                ESRI SATELLITE
              </span>
            </div>
            <SatelliteMap
              centroid={centroid}
              zoom={11}
              boundary={boundary}
              firmsPoints={firmsPoints}
              height="380px"
              className="rounded-t-none"
            />
          </div>

          {/* Section 1: OBSERVED Source Facts */}
          <Panel>
            <div className="border-b border-[var(--cx-border)] px-5 py-3">
              <span className="cx-eyebrow">OBSERVED</span>
              <h2 className="text-sm font-semibold text-white">
                Observation Provenance
              </h2>
            </div>
            <div className="grid gap-4 p-5 text-xs sm:grid-cols-2">
              <div>
                <span className="cx-label block text-[9px]">Observation Source</span>
                <p className="mt-1 text-[var(--cx-text)] font-medium">
                  {data.event.sourceName}
                </p>
                <p className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                  {data.event.sourceInstrument ?? "Instrument unspecified"}
                </p>
              </div>

              <div>
                <span className="cx-label block text-[9px]">Observation Time</span>
                <p className="cx-mono mt-1 text-[var(--cx-text)]">
                  {formatDate(data.event.observedAt)}
                </p>
                <p className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                  Origin: {data.event.originType}
                </p>
              </div>

              <div>
                <span className="cx-label block text-[9px]">Boundary Evidence</span>
                <div className="mt-1">
                  {assessment ? (
                    <EvidenceBadge
                      label={assessment.evidence[0]?.label ?? "ESTIMATED"}
                    />
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              <div>
                <span className="cx-label block text-[9px]">Audit Priority</span>
                <p className="cx-mono mt-1 font-semibold text-[var(--cx-text)]">
                  {assessment?.auditPriority ?? "ROUTINE"}
                </p>
              </div>
            </div>
          </Panel>

          {/* Section 2: Blockchain Cryptographic Anchors */}
          <Panel>
            <div className="border-b border-[var(--cx-border)] px-5 py-3">
              <span className="cx-eyebrow">EVIDENCE COMMITMENTS</span>
              <h2 className="text-sm font-semibold text-white">
                Cryptographic Blockchain Anchors
              </h2>
            </div>
            {data.anchors.length === 0 ? (
              <EmptyState
                title="No anchors committed"
                detail="Cryptographic evidence commitments are submitted asynchronously and do not block incident investigation."
              />
            ) : (
              <div className="divide-y divide-[var(--cx-border-subtle)]">
                {data.anchors.map((anchor) => (
                  <div key={anchor.id} className="p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="cx-mono font-medium text-white">
                        {anchor.eventType}
                      </span>
                      <span className="cx-mono text-[9px] uppercase tracking-wider text-[var(--cx-accent)]">
                        {anchor.status}
                      </span>
                    </div>
                    <p className="cx-mono mt-2 break-all text-[10px] text-[var(--cx-text-muted)]">
                      {anchor.txHash ??
                        anchor.failureReason ??
                        "Pending cryptographic submission"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Right Column: Deterministic Calculations, AI Narrative & Timeline */}
        <div className="space-y-6">
          {/* Section 3: CALCULATED Deterministic Assessment */}
          <Panel>
            <div className="border-b border-[var(--cx-border)] px-5 py-3">
              <span className="cx-eyebrow">CALCULATED</span>
              <h2 className="text-sm font-semibold text-white">
                Deterministic Risk Engine
              </h2>
            </div>
            {!assessment ? (
              <EmptyState
                title="Assessment unavailable"
                detail="This incident is under evaluation. Deterministic risk numbers have not yet been committed."
              />
            ) : (
              <div className="space-y-4 p-5 text-xs">
                <div className="grid grid-cols-2 gap-4 cx-mono text-[11px]">
                  <div>
                    <span className="cx-label block text-[9px]">Engine Version</span>
                    <span className="text-[var(--cx-text)]">
                      {assessment.engineVersion}
                    </span>
                  </div>
                  <div>
                    <span className="cx-label block text-[9px]">Methodology</span>
                    <span className="text-[var(--cx-text)]">
                      {assessment.methodologyVersion}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="cx-label block text-[9px]">Uncertainty Disclosure</span>
                  <p className="mt-1 text-[var(--cx-text-secondary)] leading-5">
                    {assessment.uncertaintyNotes ??
                      "No specific uncertainty caveats recorded for this assessment run."}
                  </p>
                </div>
              </div>
            )}
          </Panel>

          {/* Section 4: AI Narrative Interpretation */}
          <Panel>
            <div className="border-b border-[var(--cx-border)] px-5 py-3">
              <span className="cx-eyebrow">AI INTERPRETATION</span>
              <h2 className="text-sm font-semibold text-white">
                Contextual Synthesis
              </h2>
            </div>
            {!assessment?.aiReport ? (
              <EmptyState
                title="Interpretation unavailable"
                detail="AI report generation is non-blocking. Deterministic assessment data and human audit controls remain fully available."
              />
            ) : (
              <div className="space-y-4 p-5 text-xs">
                {(
                  [
                    ["Observed Facts", assessment.aiReport.facts],
                    ["Estimated Impacts", assessment.aiReport.estimatedImpacts],
                    ["Uncertainties", assessment.aiReport.uncertainties],
                    [
                      "Portfolio Consequences",
                      assessment.aiReport.portfolioConsequences,
                    ],
                    ["Recommendations", assessment.aiReport.recommendations],
                  ] as const
                ).map(([title, text]) => (
                  <div key={title} className="border-b border-[var(--cx-border-subtle)] pb-3 last:border-b-0 last:pb-0">
                    <span className="cx-label text-[9px] text-[var(--cx-accent)]">
                      {title}
                    </span>
                    <p className="mt-1 text-[var(--cx-text-secondary)] leading-relaxed">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Section 5: Evidentiary Audit Timeline */}
          <Panel>
            <div className="border-b border-[var(--cx-border)] px-5 py-3">
              <span className="cx-eyebrow">AUDIT HISTORY</span>
              <h2 className="text-sm font-semibold text-white">
                Evidentiary Timeline ({timeline.length} records)
              </h2>
            </div>
            {timeline.length === 0 ? (
              <EmptyState
                title="No timeline entries"
                detail="No audit history or status transitions recorded."
              />
            ) : (
              <div className="divide-y divide-[var(--cx-border-subtle)]">
                {timeline.map((entry) => (
                  <div key={entry.id} className="p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        {entry.title}
                      </span>
                      <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                        {formatDate(entry.date)}
                      </span>
                    </div>
                    <p className="mt-1 text-[var(--cx-text-secondary)]">
                      {entry.detail}
                    </p>
                    <span className="cx-mono mt-1 inline-block text-[9px] uppercase tracking-wider text-[var(--cx-text-muted)]">
                      Recorded by: {entry.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}
