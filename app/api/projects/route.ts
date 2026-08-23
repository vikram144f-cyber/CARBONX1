import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { area, centroid } from "@turf/turf";
import booleanValid from "@turf/boolean-valid";
import type { Feature, Polygon, MultiPolygon } from "geojson";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { BoundaryQuality, HoldingStatus } from "@prisma/client";
import { saveProject, StoredProject } from "@/lib/services/project-store";

function formatId(name: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `project_${clean}_${Date.now().toString(36).slice(-4)}`;
}

export async function POST(request: Request) {
  try {
    let name = "Custom Carbon Reserve";
    let project_type = "AFFORESTATION";
    let area_hectares = 100.0;
    let claimed_tco2e = 10000.0;
    let description = "";
    let country_code = "IN";
    let boundary_geojson: unknown = null;
    let pddFile: File | null = null;
    let geoFile: File | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      name = (formData.get("name") as string) || name;
      project_type = (formData.get("project_type") as string) || project_type;
      area_hectares = parseFloat((formData.get("area_hectares") as string) || "100.0");
      claimed_tco2e = parseFloat((formData.get("claimed_tco2e") as string) || "10000.0");
      description = (formData.get("description") as string) || "";
      country_code = (formData.get("country_code") as string) || country_code;

      const rawGeo = formData.get("boundary_geojson");
      if (typeof rawGeo === "string" && rawGeo.trim().startsWith("{")) {
        try {
          boundary_geojson = JSON.parse(rawGeo);
        } catch {}
      }

      pddFile = (formData.get("pdd_file") as File) || null;
      geoFile = (formData.get("geojson_file") as File) || null;
    } else {
      const raw = await request.json();
      name = raw.name || name;
      project_type = raw.project_type || project_type;
      area_hectares = parseFloat(raw.area_hectares || 100.0);
      claimed_tco2e = parseFloat(raw.claimed_tco2e || 10000.0);
      description = raw.description || "";
      country_code = raw.country_code || country_code;
      boundary_geojson = raw.boundary_geojson;
    }

    const projectId = formatId(name);

    // 1. Save uploaded physical files to public/uploads/
    let pddPath: string | null = null;
    let pddFileName: string | null = null;
    let geojsonPath: string | null = null;

    const uploadsPddDir = path.join(process.cwd(), "public", "uploads", "pdd");
    const uploadsGeoDir = path.join(process.cwd(), "public", "uploads", "geojson");

    try {
      await fs.mkdir(uploadsPddDir, { recursive: true });
      await fs.mkdir(uploadsGeoDir, { recursive: true });
    } catch {}

    if (pddFile && pddFile.size > 0) {
      pddFileName = pddFile.name;
      const cleanFileName = `${projectId}_${pddFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const filePath = path.join(uploadsPddDir, cleanFileName);
      const buffer = Buffer.from(await pddFile.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      pddPath = `/uploads/pdd/${cleanFileName}`;
      console.log(`[ProjectAPI] Saved uploaded PDD document to ${filePath}`);
    }

    if (geoFile && geoFile.size > 0) {
      const cleanGeoName = `${projectId}_${geoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const geoFilePath = path.join(uploadsGeoDir, cleanGeoName);
      const text = await geoFile.text();
      await fs.writeFile(geoFilePath, text, "utf8");
      geojsonPath = `/uploads/geojson/${cleanGeoName}`;
      console.log(`[ProjectAPI] Saved uploaded GeoJSON boundary to ${geoFilePath}`);

      if (!boundary_geojson) {
        try {
          boundary_geojson = JSON.parse(text);
        } catch {}
      }
    }

    // 2. Process GeoJSON Boundary & Calculate Exact Real Area with Turf.js
    let measuredAreaHa = area_hectares;
    let centroidLng = 76.132;
    let centroidLat = 11.685;
    let geojsonPayload: Feature<Polygon | MultiPolygon>;
    let boundaryQuality: BoundaryQuality = BoundaryQuality.HIGH;

    if (boundary_geojson && typeof boundary_geojson === "object") {
      try {
        let feat = boundary_geojson as Record<string, unknown>;
        if (
          feat.type === "FeatureCollection" &&
          Array.isArray(feat.features) &&
          feat.features[0]
        ) {
          feat = feat.features[0] as Record<string, unknown>;
        }

        if (feat.type !== "Feature") {
          feat = {
            type: "Feature",
            properties: {},
            geometry: feat,
          };
        }

        const validFeature = feat as unknown as Feature<Polygon | MultiPolygon>;
        try {
          const isValid = booleanValid(validFeature);
          if (!isValid) boundaryQuality = BoundaryQuality.MEDIUM;
        } catch {
          boundaryQuality = BoundaryQuality.MEDIUM;
        }

        const areaM2 = area(validFeature);
        if (Number.isFinite(areaM2) && areaM2 > 0) {
          measuredAreaHa = parseFloat((areaM2 / 10_000).toFixed(2));
        }

        const center = centroid(validFeature).geometry.coordinates;
        centroidLng = parseFloat(center[0].toFixed(6));
        centroidLat = parseFloat(center[1].toFixed(6));
        geojsonPayload = validFeature;
      } catch (err) {
        console.warn("[ProjectAPI] GeoJSON parsing warning, fallback to envelope", err);
        geojsonPayload = createDefaultEnvelope(centroidLng, centroidLat, area_hectares);
      }
    } else {
      geojsonPayload = createDefaultEnvelope(centroidLng, centroidLat, area_hectares);
      boundaryQuality = BoundaryQuality.MEDIUM;
    }

    // 3. Prepare StoredProject in Shared Memory Store
    const storedRecord: StoredProject = {
      id: projectId,
      name,
      description: description || `Uploaded ${project_type} carbon intelligence asset`,
      registryId: `VCS-${Math.floor(1000 + Math.random() * 9000)}`,
      methodology: project_type === "CONSERVATION" ? "VM0007" : "AR-ACM0003",
      countryCode: country_code || "IN",
      centroidLng,
      centroidLat,
      claimedAreaHa: area_hectares,
      pddFileName: pddFileName ?? (pddPath ? "Uploaded_PDD.pdf" : null),
      pddPath,
      geojsonPath,
      boundaries: [
        {
          id: `b_${projectId}`,
          version: 1,
          geojson: geojsonPayload,
          source: geojsonPath ? `Uploaded File: ${geojsonPath}` : "Uploaded GeoJSON / Shapefile",
          sourceUrl: geojsonPath,
          quality: boundaryQuality,
          verifiedAt: null,
          areaHa: measuredAreaHa,
          isCurrent: true,
        },
      ],
      creditHoldings: [
        {
          id: `hold_${projectId}`,
          vintage: 2024,
          registrySerialRef: `SERIAL-${projectId}-2024`,
          issuedQuantity: claimed_tco2e,
          heldQuantity: claimed_tco2e,
          status: "ACTIVE",
          refValuePerUnit: 24.5,
          refCurrency: "USD",
          valuationBasis: "MARKET",
        },
      ],
      incidents: [],
    };

    saveProject(storedRecord);

    // 4. Attempt DB Sync asynchronously
    try {
      let portfolio = await prisma.portfolio.findFirst();
      if (!portfolio) {
        let org = await prisma.organization.findFirst();
        if (!org) {
          org = await prisma.organization.create({
            data: { name: "CARBONX Global Portfolio Org" },
          });
        }
        portfolio = await prisma.portfolio.create({
          data: {
            name: "CARBONX Global Monitored Assets",
            organizationId: org.id,
          },
        });
      }

      await prisma.$transaction(async (tx) => {
        const p = await tx.carbonProject.create({
          data: {
            id: projectId,
            portfolioId: portfolio.id,
            name,
            description: storedRecord.description,
            registryId: storedRecord.registryId,
            methodology: storedRecord.methodology,
            countryCode: storedRecord.countryCode,
            centroidLng,
            centroidLat,
          },
        });

        await tx.projectBoundary.create({
          data: {
            projectId: p.id,
            version: 1,
            geojson: geojsonPayload as unknown as import("@prisma/client").Prisma.InputJsonValue,
            source: geojsonPath ? `Uploaded File: ${geojsonPath}` : "Uploaded GeoJSON / Shapefile",
            sourceUrl: geojsonPath,
            quality: boundaryQuality,
            areaHa: measuredAreaHa,
            acquiredAt: new Date(),
            isCurrent: true,
          },
        });

        await tx.creditHolding.create({
          data: {
            projectId: p.id,
            vintage: 2024,
            registrySerialRef: `SERIAL-${p.id}-2024`,
            issuedQuantity: claimed_tco2e,
            heldQuantity: claimed_tco2e,
            status: HoldingStatus.ACTIVE,
            refValuePerUnit: 24.5,
            refCurrency: "USD",
            valuationBasis: "MARKET",
          },
        });
      });
    } catch (dbErr) {
      console.warn("[ProjectAPI] Database sync warning, cached in memory store", dbErr);
    }

    return successResponse(
      {
        id: projectId,
        name,
        areaHa: measuredAreaHa,
        claimedAreaHa: area_hectares,
        claimedCarbon: claimed_tco2e,
        centroid: [centroidLng, centroidLat],
        quality: boundaryQuality,
        pddPath,
        geojsonPath,
      },
      201,
    );
  } catch (error) {
    console.error("[ProjectAPI] Failed to process project submission", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to submit project for verification",
      500,
    );
  }
}

function createDefaultEnvelope(
  lng: number,
  lat: number,
  areaHa: number,
): Feature<Polygon> {
  const delta = Math.sqrt(areaHa / 10000) * 0.01 || 0.01;
  return {
    type: "Feature",
    properties: { calculated_area_ha: areaHa },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lng - delta, lat - delta],
          [lng + delta, lat - delta],
          [lng + delta, lat + delta],
          [lng - delta, lat + delta],
          [lng - delta, lat - delta],
        ],
      ],
    },
  };
}
