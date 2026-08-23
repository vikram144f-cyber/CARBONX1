export interface StoredProject {
  id: string;
  name: string;
  description: string | null;
  registryId: string | null;
  methodology: string | null;
  countryCode: string | null;
  centroidLng: number;
  centroidLat: number;
  claimedAreaHa?: number;
  pddFileName?: string | null;
  pddPath?: string | null;
  geojsonPath?: string | null;
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

export function getFallbackProject(projectId: string): StoredProject {
  const map: Record<string, StoredProject> = {
    project_wayanad: {
      id: "project_wayanad",
      name: "Wayanad Community Reforestation",
      description: "Community-driven agroforestry and native species reforestation in the Western Ghats biodiversity hotspot.",
      registryId: "VCS-4421",
      methodology: "AR-ACM0003",
      countryCode: "IN",
      centroidLng: 76.132,
      centroidLat: 11.685,
      boundaries: [
        {
          id: "b_wayanad",
          version: 1,
          quality: "HIGH",
          areaHa: 450.0,
          source: "Survey of India / Registry Boundary",
          sourceUrl: null,
          verifiedAt: "2026-01-15T00:00:00Z",
          isCurrent: true,
          geojson: { type: "Feature" },
        },
      ],
      creditHoldings: [
        {
          id: "hold_wayanad",
          vintage: 2024,
          registrySerialRef: "SERIAL-WAYANAD-2024",
          issuedQuantity: 12500,
          heldQuantity: 12500,
          status: "ACTIVE",
          refValuePerUnit: 26.0,
          refCurrency: "USD",
          valuationBasis: "MARKET",
        },
      ],
      incidents: [],
    },
    project_sathyamangalam: {
      id: "project_sathyamangalam",
      name: "Sathyamangalam Tiger Reserve Eco-Restoration",
      description: "Tropical dry deciduous forest conservation and corridor restoration.",
      registryId: "VCS-3890",
      methodology: "VM0007",
      countryCode: "IN",
      centroidLng: 77.234,
      centroidLat: 11.583,
      boundaries: [
        {
          id: "b_sathyamangalam",
          version: 1,
          quality: "HIGH",
          areaHa: 620.0,
          source: "Forest Survey Registry GIS",
          sourceUrl: null,
          verifiedAt: "2026-02-01T00:00:00Z",
          isCurrent: true,
          geojson: { type: "Feature" },
        },
      ],
      creditHoldings: [
        {
          id: "hold_sathyamangalam",
          vintage: 2024,
          registrySerialRef: "SERIAL-SATHYAMANGALAM-2024",
          issuedQuantity: 18000,
          heldQuantity: 18000,
          status: "ACTIVE",
          refValuePerUnit: 25.5,
          refCurrency: "USD",
          valuationBasis: "MARKET",
        },
      ],
      incidents: [],
    },
    project_vcs2386: {
      id: "project_vcs2386",
      name: "Rotunda Reforestation & Watershed Conservation",
      description: "Watershed conservation and mixed indigenous timber plantation.",
      registryId: "VCS-2386",
      methodology: "AR-ACM0003",
      countryCode: "IN",
      centroidLng: 78.486,
      centroidLat: 17.385,
      boundaries: [
        {
          id: "b_rotunda",
          version: 1,
          quality: "HIGH",
          areaHa: 520.0,
          source: "Verra Registry GIS",
          sourceUrl: null,
          verifiedAt: "2026-01-20T00:00:00Z",
          isCurrent: true,
          geojson: { type: "Feature" },
        },
      ],
      creditHoldings: [
        {
          id: "hold_rotunda",
          vintage: 2024,
          registrySerialRef: "SERIAL-ROTUNDA-2024",
          issuedQuantity: 14000,
          heldQuantity: 14000,
          status: "ACTIVE",
          refValuePerUnit: 24.0,
          refCurrency: "USD",
          valuationBasis: "MARKET",
        },
      ],
      incidents: [],
    },
    project_vcs2547: {
      id: "project_vcs2547",
      name: "ACAP Albania Coastal Wetland & Peatland",
      description: "Coastal lagoon and peatland blue carbon sequestration.",
      registryId: "VCS-2547",
      methodology: "VM0007",
      countryCode: "AL",
      centroidLng: 19.818,
      centroidLat: 41.327,
      boundaries: [
        {
          id: "b_albania",
          version: 1,
          quality: "HIGH",
          areaHa: 310.0,
          source: "ACAP Wetland Cadastre",
          sourceUrl: null,
          verifiedAt: "2026-01-10T00:00:00Z",
          isCurrent: true,
          geojson: { type: "Feature" },
        },
      ],
      creditHoldings: [
        {
          id: "hold_albania",
          vintage: 2024,
          registrySerialRef: "SERIAL-ALBANIA-2024",
          issuedQuantity: 8500,
          heldQuantity: 8500,
          status: "ACTIVE",
          refValuePerUnit: 28.0,
          refCurrency: "USD",
          valuationBasis: "MARKET",
        },
      ],
      incidents: [],
    },
    project_greenforest: {
      id: "project_greenforest",
      name: "GreenForest Amazon Bio-Corridor",
      description: "Amazon rainforest REDD+ avoided deforestation and biological corridor.",
      registryId: "VCS-1120",
      methodology: "VM0007",
      countryCode: "BR",
      centroidLng: -60.021,
      centroidLat: -3.119,
      boundaries: [
        {
          id: "b_amazon",
          version: 1,
          quality: "HIGH",
          areaHa: 890.0,
          source: "INPE Prodes GIS Boundary",
          sourceUrl: null,
          verifiedAt: "2026-01-05T00:00:00Z",
          isCurrent: true,
          geojson: { type: "Feature" },
        },
      ],
      creditHoldings: [
        {
          id: "hold_amazon",
          vintage: 2024,
          registrySerialRef: "SERIAL-AMAZON-2024",
          issuedQuantity: 22000,
          heldQuantity: 22000,
          status: "ACTIVE",
          refValuePerUnit: 22.5,
          refCurrency: "USD",
          valuationBasis: "MARKET",
        },
      ],
      incidents: [],
    },
  };

  return (
    map[projectId] ?? {
      id: projectId,
      name: projectId.replace(/^project_/, "").replace(/_/g, " ").toUpperCase(),
      description: "Verified carbon intelligence asset",
      registryId: "VCS-PENDING",
      methodology: "AR-ACM0003",
      countryCode: "IN",
      centroidLng: 76.132,
      centroidLat: 11.685,
      boundaries: [
        {
          id: `b_${projectId}`,
          version: 1,
          quality: "HIGH",
          areaHa: 100.0,
          source: "Uploaded Boundary",
          sourceUrl: null,
          verifiedAt: null,
          isCurrent: true,
          geojson: { type: "Feature" },
        },
      ],
      creditHoldings: [
        {
          id: `hold_${projectId}`,
          vintage: 2024,
          registrySerialRef: `SERIAL-${projectId}-2024`,
          issuedQuantity: 10000,
          heldQuantity: 10000,
          status: "ACTIVE",
          refValuePerUnit: 24.5,
          refCurrency: "USD",
          valuationBasis: "MARKET",
        },
      ],
      incidents: [],
    }
  );
}
