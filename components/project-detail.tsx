"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import {
  EmptyState,
  ErrorState,
  formatCurrency,
  formatDate,
  formatQuantity,
  LoadingState,
  Panel,
  RiskBadge,
} from "./ui";
import {
  projectResponseSchema,
  type ProjectResponse,
} from "../lib/validations/portfolio";
import { TrustScoreCard } from "./trust-score-card";
import type { FirmsPoint, GeoJsonFeature, SatelliteMapProps } from "./satellite-map";

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
          Loading project boundary map…
        </span>
      </div>
    ),
  },
) as React.ComponentType<SatelliteMapProps>;

type ProjectEvent = {
  id: string;
  longitude: number;
  latitude: number;
  sourceConfidence: number | null;
  observedAt: string | null;
  sourceInstrument: string | null;
  sourceName: string;
};

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ProjectEvent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      );
      const envelope: unknown = await response.json();
      const body = envelope as { success?: unknown; data?: unknown };
      if (!response.ok || body.success !== true)
        throw new Error("Project read failed");
      setData(projectResponseSchema.parse(body.data));
    } catch {
      setError("Project record could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadEvents = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/events`,
        { cache: "no-store" },
      );
      const envelope: unknown = await response.json();
      const body = envelope as { success?: boolean; data?: ProjectEvent[] };
      if (body.success && Array.isArray(body.data)) setEvents(body.data);
    } catch {
      // non-fatal
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    void loadEvents();
  }, [load, loadEvents]);

  if (loading) return <LoadingState label="Loading project boundary record" />;
  if (error || !data)
    return (
      <ErrorState
        message={error ?? "Project unavailable."}
        onRetry={() => void load()}
      />
    );

  const activeIncidents = data.incidents.filter(
    (incident) => incident.status !== "RESOLVED",
  );

  const centroid: [number, number] = [data.centroidLng, data.centroidLat];
  const boundary: GeoJsonFeature | null = data.boundaries[0]
    ? (data.boundaries[0] as unknown as GeoJsonFeature)
    : null;

  const firmsPoints: FirmsPoint[] = events.map((ev) => ({
    id: ev.id,
    longitude: ev.longitude,
    latitude: ev.latitude,
    sourceConfidence: ev.sourceConfidence,
    observedAt: ev.observedAt,
    sourceInstrument: ev.sourceInstrument,
    sourceName: ev.sourceName,
  }));

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 sm:py-8">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 cx-mono text-[11px] text-[var(--cx-text-muted)]">
        <Link
          href="/?mode=command"
          className="transition hover:text-[var(--cx-accent)]"
        >
          PORTFOLIO
        </Link>
        <span>/</span>
        <span className="text-[var(--cx-text)]">{data.name}</span>
      </div>

      {/* Project Header */}
      <header className="mt-3 border-b border-[var(--cx-border)] pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="cx-badge-provenance">
                {data.registryId ?? "VCS UNREGISTERED"}
              </span>
              <span className="cx-mono text-xs text-[var(--cx-text-muted)]">
                {data.countryCode ?? "—"} · {data.methodology ?? "Forestry Methodology"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-medium tracking-tight text-white sm:text-3xl">
              {data.name}
            </h1>
            <p className="cx-mono mt-1 text-[11px] text-[var(--cx-text-muted)]">
              CENTROID: {data.centroidLat.toFixed(4)}°N, {data.centroidLng.toFixed(4)}°E
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 border-t border-[var(--cx-border-subtle)] pt-3 lg:border-t-0 lg:pt-0">
            <div>
              <span className="cx-label block text-[9px]">Held Inventory</span>
              <span className="cx-mono text-sm font-semibold text-white">
                {formatQuantity(data.holdingSummary.heldQuantity)} Credits
              </span>
            </div>
            <div>
              <span className="cx-label block text-[9px]">Reference Value</span>
              <span className="cx-mono text-sm font-semibold text-[var(--cx-warning)]">
                {formatCurrency(data.holdingSummary.referenceValue)}
              </span>
            </div>
            <div>
              <span className="cx-label block text-[9px]">Active Alerts</span>
              <span
                className={`cx-mono text-sm font-semibold ${
                  activeIncidents.length > 0
                    ? "text-[var(--cx-critical)]"
                    : "text-[var(--cx-success)]"
                }`}
              >
                {activeIncidents.length} Active
              </span>
            </div>
            <div>
              <Link
                href={`/projects/${data.id}/results`}
                className="cx-mono inline-flex items-center gap-1.5 rounded border border-[rgba(237,142,89,0.35)] bg-[rgba(237,142,89,0.12)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--cx-accent)] transition hover:bg-[rgba(237,142,89,0.22)]"
              >
                <span>AI TRUST SCORE →</span>
              </Link>
            </div>
          </div>
        </div>
      </header>


      {/* ── PRIMARY HERO: Satellite View & Boundary ─────────────────────── */}
      <section className="mt-6">
        <div className="relative">
          <div className="flex items-center justify-between border-x border-t border-[var(--cx-border)] bg-[var(--cx-surface)] px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--cx-accent)] animate-pulse" />
              <span className="cx-mono text-[10px] uppercase tracking-wider text-[var(--cx-text)]">
                Spatial Boundary & Thermal Observations · {firmsPoints.length} FIRMS points
              </span>
            </div>
            <span className="cx-mono hidden text-[10px] text-[var(--cx-text-muted)] sm:inline">
              ESRI WORLD IMAGERY · BUFFER: 5.0 KM
            </span>
          </div>

          <SatelliteMap
            centroid={centroid}
            zoom={10}
            boundary={boundary}
            firmsPoints={firmsPoints}
            height="440px"
            className="rounded-t-none"
          />

          <div className="border-x border-b border-[var(--cx-border)] bg-[var(--cx-surface-inset)] px-4 py-2 text-[10px] text-[var(--cx-text-muted)] cx-mono">
            {firmsPoints.length > 0
              ? "⚠ Note: FIRMS markers represent satellite point detections — buffered zones are ESTIMATED, not measured ground perimeters."
              : "No FIRMS thermal anomaly points currently detected within the project bounding box."}
          </div>
        </div>
      </section>

      {/* ── AI Truth Score & Evidence Verification ──────────────────────── */}
      <TrustScoreCard projectId={data.id} />

      {/* ── Structured Sections: Provenance, Holdings, Incidents ─────────── */}
      <section className="mt-8 grid gap-8 lg:grid-cols-2">

        {/* Boundary Provenance */}
        <Panel>
          <div className="border-b border-[var(--cx-border)] px-5 py-3">
            <span className="cx-eyebrow">GEOMETRIC PROVENANCE</span>
            <h2 className="text-sm font-semibold text-white">
              Registered Boundary History
            </h2>
          </div>
          {data.boundaries.length === 0 ? (
            <EmptyState
              title="No boundary records"
              detail="This project has no registered boundary polygon in the database."
            />
          ) : (
            <div className="divide-y divide-[var(--cx-border-subtle)]">
              {data.boundaries.map((b) => (
                <div key={b.id} className="p-5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      Version {b.version}{" "}
                      {b.isCurrent ? (
                        <span className="ml-1 text-[9px] uppercase tracking-wider text-[var(--cx-accent)]">
                          [Current]
                        </span>
                      ) : null}
                    </span>
                    <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                      Verified {formatDate(b.verifiedAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-[var(--cx-text-secondary)]">{b.source}</p>
                  {b.sourceUrl ? (
                    <a
                      href={b.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="cx-mono mt-1 block truncate text-[11px] text-[var(--cx-accent)] hover:underline"
                    >
                      {b.sourceUrl}
                    </a>
                  ) : null}
                  <div className="mt-2 cx-mono text-[10px] text-[var(--cx-text-muted)]">
                    Quality Level: {b.quality} · Area:{" "}
                    {b.areaHa ? `${formatQuantity(b.areaHa)} ha` : "n/a"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Credit Holdings Inventory */}
        <Panel>
          <div className="border-b border-[var(--cx-border)] px-5 py-3">
            <span className="cx-eyebrow">INVENTORY</span>
            <h2 className="text-sm font-semibold text-white">
              Credit Holdings & Valuation
            </h2>
          </div>
          {data.holdings.length === 0 ? (
            <EmptyState
              title="No holding records"
              detail="No CreditHolding records are registered for this project in the system of record."
            />
          ) : (
            <div className="divide-y divide-[var(--cx-border-subtle)]">
              {data.holdings.map((h) => (
                <div key={h.id} className="p-5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="cx-mono font-medium text-white">
                      {h.registrySerialRef ?? "No serial ref"}
                    </span>
                    <span className="cx-mono text-[10px] text-[var(--cx-text-muted)]">
                      {h.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between cx-mono">
                    <span className="text-[var(--cx-text-secondary)]">
                      {formatQuantity(h.heldQuantity)} credits
                    </span>
                    <span className="text-[var(--cx-warning)]">
                      {formatCurrency(h.refValuePerUnit, h.refCurrency)} / unit
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      {/* Incident History Table */}
      <Panel className="mt-8">
        <div className="border-b border-[var(--cx-border)] px-5 py-3">
          <span className="cx-eyebrow">ALERT TIMELINE</span>
          <h2 className="text-sm font-semibold text-white">
            Incident Investigation Queue
          </h2>
        </div>
        {data.incidents.length === 0 ? (
          <EmptyState
            title="No incidents recorded"
            detail="No confirmed environmental event overlaps have occurred for this project."
          />
        ) : (
          <div className="divide-y divide-[var(--cx-border-subtle)]">
            {data.incidents.map((incident) => (
              <Link
                href={`/incidents/${incident.id}`}
                key={incident.id}
                className="flex flex-col gap-2 p-5 text-xs transition hover:bg-[var(--cx-surface-subtle)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-white">
                    {incident.eventType} Event
                  </p>
                  <p className="cx-mono mt-0.5 text-[10px] text-[var(--cx-text-muted)]">
                    {incident.status} · Opened {formatDate(incident.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <RiskBadge risk={incident.integrityRisk} />
                  <span className="cx-mono text-xs text-[var(--cx-accent)]">
                    Inspect Investigation →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
