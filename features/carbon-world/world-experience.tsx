"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchPortfolioData } from "../../lib/client/portfolio";
import type { PortfolioResponse } from "../../lib/validations/portfolio";
import { isWebGLAvailable } from "../investigation-3d/webgl";
import { CommandModeFallback } from "./command-mode-fallback";
import { GuidedIntro } from "./guided-intro";
import { InteractionPrompt } from "./interaction-prompt";
import {
  resolveWorldRoute,
  type WorldDestination,
  type WorldDestinationId,
  type WorldState,
  worldStatusLine,
} from "./navigation-state";

const CarbonWorldScene = dynamic(
  () => import("./world-scene").then((module) => module.CarbonWorldScene),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-[0.2em] text-emerald-200/60">Loading operations world…</div>,
  },
);

const pendingWorldState: WorldState = {
  projectCount: null,
  projects: [],
  activeIncidentCount: null,
  incidents: [],
  systemReady: false,
};

function toWorldState(data: PortfolioResponse): WorldState {
  return {
    projectCount: data.summary.totalProjects,
    projects: data.projects.map((project) => ({ id: project.id, name: project.name })),
    activeIncidentCount: data.summary.activeIncidents,
    incidents: data.activeIncidents.map((incident) => ({ id: incident.id, status: incident.status })),
    systemReady: true,
  };
}

function WorldHud({
  state,
  error,
  onShowHelp,
  onCommandMode,
}: {
  state: WorldState;
  error: string | null;
  onShowHelp: () => void;
  onCommandMode: () => void;
}) {
  const online = state.systemReady && !error;
  return (
    <div className="pointer-events-auto absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#07110f]/65 px-4 py-3 shadow-xl backdrop-blur-md sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-[11px] font-bold text-emerald-200">CX</span>
          <div><p className="text-xs font-semibold tracking-[0.24em] text-white">CARBONX</p><p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-emerald-300/65">Carbon intelligence operations</p></div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 sm:gap-3">
        <div className="rounded-2xl border border-white/10 bg-[#07110f]/65 px-4 py-3 text-right shadow-xl backdrop-blur-md sm:px-5">
          <p className={`flex items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${online ? "text-emerald-200" : "text-amber-200"}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" : "animate-pulse bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.7)]"}`} /> {error ? "Data sync delayed" : online ? "System online" : "Connecting data"}</p>
          <p className="mt-2 text-[11px] text-slate-400">{error ?? worldStatusLine(state)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onShowHelp} className="pointer-events-auto rounded-full border border-white/10 bg-[#07110f]/65 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 backdrop-blur-md transition hover:border-white/20 hover:text-white">Controls</button>
          <button type="button" onClick={onCommandMode} className="pointer-events-auto rounded-full border border-white/15 bg-[#07110f]/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 backdrop-blur-md transition hover:border-emerald-300/30 hover:text-emerald-200">Command Mode</button>
        </div>
      </div>
    </div>
  );
}

export function WorldExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const focus = searchParams.get("focus") ?? undefined;
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [webglReady, setWebglReady] = useState<boolean | null>(null);
  const [touchDevice, setTouchDevice] = useState(false);
  const [introActive, setIntroActive] = useState(false);
  const [nearby, setNearby] = useState<WorldDestination | null>(null);

  useEffect(() => {
    setWebglReady(isWebGLAvailable());
    setTouchDevice(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchPortfolioData());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Live portfolio data could not be loaded.");
    }
  }, []);

  useEffect(() => {
    if (mode !== "command") void load();
  }, [load, mode]);

  const state = useMemo(() => (data ? toWorldState(data) : pendingWorldState), [data]);
  const enterWorld = useCallback(() => {
    setIntroActive(false);
  }, []);
  const openDestination = useCallback((destinationId: WorldDestinationId) => {
    router.push(resolveWorldRoute(destinationId, state));
  }, [router, state]);

  if (mode === "command") return <CommandModeFallback focus={focus} initialData={data} />;
  if (webglReady === null) return <div className="grid min-h-screen place-items-center bg-[#020b08] text-xs uppercase tracking-[0.2em] text-emerald-200/70">Starting operations world…</div>;
  if (!webglReady) return <CommandModeFallback reason="WebGL is unavailable in this browser. Command Mode remains fully functional." focus={focus} />;
  if (touchDevice) return <CommandModeFallback reason="Touch devices use Command Mode for a reliable responsive experience." focus={focus} />;

  return (
    <div className="relative h-[100svh] min-h-[640px] overflow-hidden bg-[#04120e]">
      <WorldHud state={state} error={error} onShowHelp={() => setIntroActive(true)} onCommandMode={() => router.push("/?mode=command")} />
      <CarbonWorldScene state={state} introActive={introActive} nearbyId={nearby?.id ?? null} onNearbyChange={setNearby} onInteract={openDestination} />
      {!introActive ? <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 before:absolute before:left-1/2 before:top-0 before:h-4 before:w-px before:-translate-x-1/2 before:bg-emerald-100/35 after:absolute after:left-0 after:top-1/2 after:h-px after:w-4 after:-translate-y-1/2 after:bg-emerald-100/35" /> : null}
      <div className="pointer-events-none absolute bottom-5 left-5 z-10 hidden text-[10px] uppercase tracking-[0.16em] text-slate-400/70 sm:block">WASD / arrows to move · click canvas to look · Esc releases mouse</div>
      {!introActive && nearby ? <InteractionPrompt destination={nearby} onInteract={() => openDestination(nearby.id)} /> : null}
      {introActive ? <GuidedIntro onEnter={enterWorld} /> : null}
    </div>
  );
}
