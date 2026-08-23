export interface StoredProject {
  id: string;
  name: string;
  description: string | null;
  registryId: string | null;
  methodology: string | null;
  countryCode: string | null;
  centroidLng: number;
  centroidLat: number;
  boundaries: Array<{
    id: string;
    version: number;
    source: string;
    sourceUrl: string | null;
    quality: string;
    verifiedAt: string | null;
    areaHa: number | null;
    isCurrent: boolean;
    geojson: unknown;
  }>;
  creditHoldings: Array<{
    id: string;
    vintage: number;
    registrySerialRef: string;
    issuedQuantity: number;
    heldQuantity: number;
    status: string;
    refValuePerUnit: number;
    refCurrency: string;
    valuationBasis: string;
  }>;
  incidents: Array<{
    id: string;
    projectId: string;
    eventId: string;
    event: { id: string; type: string };
    status: string;
    createdAt: Date;
    updatedAt: Date;
    assessments: Array<{
      integrityRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      evidenceConfidence: "LOW" | "MEDIUM" | "HIGH";
      auditPriority: "ROUTINE" | "ELEVATED" | "URGENT";
      impactPct: number;
      estimatedImpactHa: number;
      creditExposure: number;
      financialExposureEst: number;
      createdAt: Date;
    }>;
  }>;
}

// Global in-memory storage to preserve dynamically created projects across requests
declare global {
  // eslint-disable-next-line no-var
  var __CARBONX_PROJECT_STORE__: Map<string, StoredProject> | undefined;
}

if (!globalThis.__CARBONX_PROJECT_STORE__) {
  globalThis.__CARBONX_PROJECT_STORE__ = new Map();
}

export const projectStore = globalThis.__CARBONX_PROJECT_STORE__;

export function saveProject(project: StoredProject): void {
  projectStore.set(project.id, project);
}

export function getStoredProject(id: string): StoredProject | null {
  return projectStore.get(id) ?? null;
}

export function getAllStoredProjects(): StoredProject[] {
  return Array.from(projectStore.values());
}
