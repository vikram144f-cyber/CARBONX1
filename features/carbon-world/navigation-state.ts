import { CARBONX_THEME } from "../../lib/theme";

export type WorldDestinationId =
  | "portfolio"
  | "projects"
  | "incidents"
  | "evidence"
  | "audit"
  | "investigation";

export type WorldDestination = {
  id: WorldDestinationId;
  label: string;
  eyebrow: string;
  description: string;
  position: [number, number, number];
  radius: number;
  accent: string;
};

export type WorldIncident = {
  id: string;
  status: string;
};

export type WorldProject = {
  id: string;
  name: string;
};

export type WorldState = {
  projectCount: number | null;
  projects?: WorldProject[];
  activeIncidentCount: number | null;
  incidents: WorldIncident[];
  systemReady: boolean;
};

export const WORLD_DESTINATIONS: readonly WorldDestination[] = [
  {
    id: "portfolio",
    label: "CARBONX HQ",
    eyebrow: "01 · intelligence",
    description: "Open the live portfolio command view.",
    position: [-15, 0, -9],
    radius: 4.5,
    accent: CARBONX_THEME.accent,
  },
  {
    id: "projects",
    label: "Project Intelligence",
    eyebrow: "02 · boundaries",
    description: "Explore carbon projects and boundary provenance.",
    position: [15, 0, -7],
    radius: 4.5,
    accent: CARBONX_THEME.highlight,
  },
  {
    id: "incidents",
    label: "Incident Command",
    eyebrow: "03 · response",
    description: "Review environmental incidents and empty-state truth.",
    position: [14, 0, 10],
    radius: 4.5,
    accent: CARBONX_THEME.warning,
  },
  {
    id: "evidence",
    label: "Evidence Vault",
    eyebrow: "04 · provenance",
    description: "Evidence and document management readiness.",
    position: [-13, 0, 12],
    radius: 4.5,
    accent: CARBONX_THEME.info,
  },
  {
    id: "audit",
    label: "Audit Center",
    eyebrow: "05 · human decision",
    description: "Open the human audit workflow for an active incident.",
    position: [0, 0, -18],
    radius: 4.5,
    accent: CARBONX_THEME.critical,
  },
  {
    id: "investigation",
    label: "Investigation Lab",
    eyebrow: "06 · spatial review",
    description: "Launch the 3D investigation for a valid incident.",
    position: [0, 0, 18],
    radius: 4.5,
    accent: CARBONX_THEME.highlight,
  },
];

export function getNearbyDestination(
  position: [number, number, number],
  destinations: readonly WorldDestination[] = WORLD_DESTINATIONS,
): WorldDestination | null {
  let nearest: WorldDestination | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const destination of destinations) {
    const distance = Math.hypot(
      position[0] - destination.position[0],
      position[2] - destination.position[2],
    );
    if (distance <= destination.radius && distance < nearestDistance) {
      nearest = destination;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function resolveWorldRoute(
  destination: WorldDestinationId,
  state: WorldState,
): string {
  const firstIncident = state.incidents[0];
  if (destination === "portfolio") return "/?mode=command";
  if (destination === "projects") {
    return state.projects?.[0]?.id
      ? `/projects/${encodeURIComponent(state.projects[0].id)}`
      : "/?mode=command&focus=projects";
  }
  if (destination === "evidence") return "/documents";
  if (destination === "incidents") {
    return firstIncident?.id
      ? `/incidents/${encodeURIComponent(firstIncident.id)}`
      : "/?mode=command&focus=incidents";
  }
  if (destination === "audit") {
    return firstIncident?.id
      ? `/incidents/${encodeURIComponent(firstIncident.id)}?mode=audit`
      : "/?mode=command&focus=incidents";
  }
  return firstIncident?.id
    ? `/incidents/${encodeURIComponent(firstIncident.id)}?mode=3d`
    : "/?mode=command&focus=incidents";
}

export function worldStatusLine(state: WorldState): string {
  if (!state.systemReady || state.projectCount === null || state.activeIncidentCount === null) {
    return "Syncing live portfolio data…";
  }
  return `${state.projectCount} projects monitored · ${state.activeIncidentCount} active incidents`;
}
