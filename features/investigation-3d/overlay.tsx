"use client";

import { Component, type ReactNode, useEffect, useState } from "react";

import { Investigation2DFallback } from "./fallback";
import { advanceInvestigationMode, type InvestigationMode } from "./interaction-state";
import { Investigation3DScene } from "./scene";
import type { InvestigationHotspot, InvestigationSceneState } from "./scene-state";
import { isWebGLAvailable } from "./webgl";

class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Investigation3DOverlay({
  data,
  onClose,
}: {
  data: InvestigationSceneState;
  onClose: () => void;
}) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [mode, setMode] = useState<InvestigationMode>("cinematic");
  const [selected, setSelected] = useState<InvestigationHotspot | null>(null);
  useEffect(() => setWebgl(isWebGLAvailable()), []);
  if (webgl === false) return <Investigation2DFallback data={data} onClose={onClose} />;
  if (webgl === null) return <div className="absolute inset-0 z-50 grid place-items-center bg-[#04100c] text-sm text-slate-400">Preparing investigation canvas…</div>;
  const fallback = <Investigation2DFallback data={data} onClose={onClose} />;
  return (
    <div className="fixed inset-0 z-50 bg-[#04100c]">
      <SceneErrorBoundary fallback={fallback}>
        <Investigation3DScene data={data} mode={mode} onSequenceComplete={() => setMode((current) => advanceInvestigationMode(current, "complete"))} onSelectHotspot={setSelected} />
      </SceneErrorBoundary>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4 sm:p-7">
        <div className="pointer-events-auto max-w-md rounded-2xl border border-white/10 bg-[#07110f]/85 p-4 backdrop-blur-sm">
          <p className="cx-label text-emerald-200/80">3D investigation · {mode === "cinematic" ? "guided approach" : "free roam"}</p>
          <h2 className="mt-2 text-lg font-semibold text-white">{data.project.name}</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">{mode === "cinematic" ? "A short camera pass is introducing the project context." : "WASD moves within the project bounds. Click the scene for mouse look."}</p>
          {data.anomalyVisible ? <p className="mt-2 text-xs text-amber-200">Backend state indicates an estimated impact zone; it is not a burned-area claim.</p> : <p className="mt-2 text-xs text-slate-500">No active estimated impact zone is present in the backend state.</p>}
        </div>
        <div className="pointer-events-auto flex gap-2">
          {mode === "cinematic" ? <button type="button" onClick={() => setMode((current) => advanceInvestigationMode(current, "skip"))} className="rounded-lg border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-200/20">Skip intro</button> : null}
          <button type="button" onClick={onClose} className="rounded-lg border border-white/15 bg-[#07110f]/85 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">Exit 3D</button>
        </div>
      </div>
      {selected ? <div className="absolute bottom-5 left-5 right-5 max-w-md rounded-2xl border border-emerald-300/20 bg-[#07110f]/95 p-4 shadow-2xl sm:bottom-7 sm:left-7 sm:right-auto"><div className="flex items-start justify-between gap-4"><div><p className="cx-label text-emerald-200/80">{selected.evidenceLabel} · {selected.kind}</p><h3 className="mt-2 text-sm font-semibold text-white">{selected.title}</h3></div><button type="button" onClick={() => setSelected(null)} className="text-xs text-slate-500 hover:text-white">Close</button></div><p className="mt-3 text-xs leading-5 text-slate-300">{selected.detail}</p></div> : null}
    </div>
  );
}
