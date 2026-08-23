"use client";

import { useMemo, useState } from "react";

import { CARBONX_THEME } from "../../lib/theme";
import {
  calculateSceneBounds,
  projectBoundaryToScene,
  projectPointToScene,
} from "../../lib/utils/geo-to-scene";
import type { InvestigationHotspot, InvestigationSceneState } from "./scene-state";

export function Investigation2DFallback({
  data,
  onClose,
}: {
  data: InvestigationSceneState;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<InvestigationHotspot | null>(null);
  const rings = useMemo(
    () =>
      data.project.boundary
        ? projectBoundaryToScene(data.project.boundary.geojson, data.project.centroid)
        : [],
    [data.project.boundary, data.project.centroid],
  );
  const bounds = useMemo(() => calculateSceneBounds(rings, 3), [rings]);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxZ - bounds.minZ);
  const toSvg = ([x, z]: [number, number]) => [
    ((x - bounds.minX) / width) * 100,
    ((z - bounds.minZ) / height) * 100,
  ];
  const hotspotPoints = data.hotspots
    .map((hotspot) => {
      const point = hotspot.coordinate
        ? projectPointToScene(hotspot.coordinate, data.project.centroid)
        : null;
      return point ? { hotspot, point: toSvg([point[0], point[1]]) } : null;
    })
    .filter((item): item is { hotspot: InvestigationHotspot; point: number[] } => Boolean(item));

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-cx-bg p-4 text-slate-100 sm:p-8">
      <div className="cx-panel mx-auto max-w-5xl rounded-3xl p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="cx-label text-amber-200/80">2D investigation fallback</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">WebGL unavailable</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              The investigation remains usable with the same real boundary, event, and risk state. No 3D-only evidence was added.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">
            Close
          </button>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Boundary v{data.project.boundary?.version ?? "—"}</span>
              <span>{data.project.boundary?.quality ?? "Boundary unavailable"}</span>
            </div>
            <svg viewBox="0 0 100 100" className="aspect-square w-full rounded-xl bg-cx-purple" role="img" aria-label="2D project boundary and evidence hotspots">
              {rings.map((ring, index) => (
                <polygon key={index} points={ring.map((point) => toSvg(point).join(",")).join(" ")} fill="rgba(52,211,153,0.12)" stroke="rgba(110,231,183,0.85)" strokeWidth="0.5" />
              ))}
              {hotspotPoints.map(({ hotspot, point }) => (
                <circle key={hotspot.id} cx={point[0]} cy={point[1]} r="2.2" fill={hotspot.kind === "RISK" ? CARBONX_THEME.critical : hotspot.kind === "EVIDENCE" ? CARBONX_THEME.info : CARBONX_THEME.warning} onClick={() => setSelected(hotspot)} className="cursor-pointer" />
              ))}
            </svg>
            <p className="mt-3 text-xs text-slate-500">Boundary source: {data.project.boundary?.source ?? "not recorded"}</p>
          </div>
          <div className="space-y-3">
            <p className="cx-label">Evidence hotspots</p>
            {data.hotspots.map((hotspot) => (
              <button key={hotspot.id} type="button" onClick={() => setSelected(hotspot)} className="block w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left hover:border-emerald-300/30 hover:bg-emerald-300/[0.06]">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/70">{hotspot.evidenceLabel}</span>
                <span className="mt-2 block text-sm font-medium text-slate-200">{hotspot.title}</span>
              </button>
            ))}
            {selected ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4" aria-live="polite"><p className="text-xs font-semibold text-emerald-200">{selected.title}</p><p className="mt-2 text-xs leading-5 text-slate-300">{selected.detail}</p></div> : <p className="text-xs leading-5 text-slate-500">Select a hotspot to inspect its backend-sourced context.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
