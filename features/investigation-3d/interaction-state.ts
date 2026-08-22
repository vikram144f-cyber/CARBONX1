import type { InvestigationHotspot } from "./scene-state";

export type InvestigationMode = "cinematic" | "explore";

export function advanceInvestigationMode(
  current: InvestigationMode,
  action: "skip" | "complete",
): InvestigationMode {
  return current === "cinematic" && (action === "skip" || action === "complete")
    ? "explore"
    : current;
}

export function findInvestigationHotspot(
  hotspots: InvestigationHotspot[],
  hotspotId: string,
): InvestigationHotspot | null {
  return hotspots.find((hotspot) => hotspot.id === hotspotId) ?? null;
}
