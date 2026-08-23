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
    loading: () => (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--cx-bg)] p-6 text-center">
        <span className="cx-mono text-xs uppercase tracking-[0.2em] text-[var(--cx-accent)]">
          Initializing 3D Operations World…
        </span>
        <a
          href="/?mode=command"
          className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] px-3 py-1.5 text-xs uppercase tracking-wider text-white transition hover:border-[var(--cx-accent)]"
        >
          Open 2D Command Console →
        </a>
      </div>
    ),
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
      <div className="cx-surface-elevated pointer-events-auto rounded-lg px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="cx-mono flex h-7 w-7 items-center justify-center rounded border border-[var(--cx-accent)] bg-[rgba(237,142,89,0.12)] text-[11px] font-bold text-[var(--cx-accent)]">CX</span>
          <div>
            <p className="cx-mono text-xs font-semibold tracking-[0.2em] text-white">CARBONX</p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--cx-text-muted)]">Operations World</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 sm:gap-3">
        <div className="cx-surface-elevated rounded-lg px-4 py-2.5 text-right">
          <p className={`cx-mono flex items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${online ? "text-[var(--cx-accent)]" : "text-[var(--cx-warning)]"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-[var(--cx-accent)]" : "animate-pulse bg-[var(--cx-warning)]"}`} />
            {error ? "Data sync delayed" : online ? "System online" : "Connecting data"}
          </p>
          <p className="cx-mono mt-1 text-[11px] text-[var(--cx-text-muted)]">{error ?? worldStatusLine(state)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onShowHelp} className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--cx-text-muted)] hover:text-white">Controls</button>
          <button type="button" onClick={onCommandMode} className="cx-mono rounded border border-[var(--cx-border-strong)] bg-[var(--cx-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-accent)] hover:bg-[rgba(237,142,89,0.1)]">Command Mode</button>
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
  if (webglReady === null) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--cx-bg)] p-6 text-center">
      <span className="cx-mono text-xs uppercase tracking-[0.2em] text-[var(--cx-accent)]">
        Starting operations world…
      </span>
      <a
        href="/?mode=command"
        className="cx-mono rounded border border-[var(--cx-border)] bg-[var(--cx-surface)] px-3 py-1.5 text-xs uppercase tracking-wider text-white transition hover:border-[var(--cx-accent)]"
      >
        Open 2D Command Console →
      </a>
    </div>
  );
  if (!webglReady) return <CommandModeFallback reason="WebGL is unavailable in this browser. Command Mode remains fully functional." focus={focus} />;
  if (touchDevice) return <CommandModeFallback reason="Touch devices use Command Mode for a reliable responsive experience." focus={focus} />;

  return (
    <div className="relative h-[100svh] min-h-[640px] overflow-hidden bg-[var(--cx-bg)]" style={{ height: "100dvh", minHeight: 640, position: "relative" }}>
      <WorldHud state={state} error={error} onShowHelp={() => setIntroActive(true)} onCommandMode={() => router.push("/?mode=command")} />
      <CarbonWorldScene state={state} introActive={introActive} nearbyId={nearby?.id ?? null} onNearbyChange={setNearby} onInteract={openDestination} />
      {!introActive ? <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 before:absolute before:left-1/2 before:top-0 before:h-4 before:w-px before:-translate-x-1/2 before:bg-[var(--cx-accent)]/40 after:absolute after:left-0 after:top-1/2 after:h-px after:w-4 after:-translate-y-1/2 after:bg-[var(--cx-accent)]/40" style={{ left: "50%", pointerEvents: "none", position: "absolute", top: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }} /> : null}
      <div className="pointer-events-none absolute bottom-5 left-5 z-10 hidden cx-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cx-text-muted)] sm:block">WASD / arrows to drive · drag canvas to orbit · E or click to enter</div>
      {!introActive && nearby ? <InteractionPrompt destination={nearby} onInteract={() => openDestination(nearby.id)} /> : null}
      {introActive ? <GuidedIntro onEnter={enterWorld} /> : null}
    </div>
  );
}
