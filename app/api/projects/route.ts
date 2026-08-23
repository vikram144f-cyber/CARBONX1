import "server-only";

import { z } from "zod";
import { area, centroid } from "@turf/turf";
import booleanValid from "@turf/boolean-valid";
import type { Feature, Polygon, MultiPolygon } from "geojson";

import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-response";
import { BoundaryQuality, HoldingStatus } from "@prisma/client";

const createProjectSchema = z.object({
  name: z.string().min(2),
  project_type: z.string().default("AFFORESTATION"),
  area_hectares: z.number().positive(),
  claimed_tco2e: z.number().positive(),
  description: z.string().optional().default(""),
  boundary_geojson: z.unknown().optional(),
  country_code: z.string().optional().default("IN"),
  pdd_filename: z.string().optional(),
});

function formatId(name: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `project_${clean}_${Date.now().toString(36).slice(-4)}`;
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = createProjectSchema.safeParse(raw);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", parsed.error.message, 400);
    }

    const {
      name,
      project_type,
      area_hectares,
      claimed_tco2e,
      description,
      boundary_geojson,
      country_code,
    } = parsed.data;

    // 1. Get or create a default portfolio
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

    // 2. Process GeoJSON Boundary
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
        console.warn(
          "[ProjectAPI] GeoJSON parsing warning, falling back to envelope",
          err,
        );
        geojsonPayload = createDefaultEnvelope(
          centroidLng,
          centroidLat,
          area_hectares,
        );
      }
    } else {
      geojsonPayload = createDefaultEnvelope(
        centroidLng,
        centroidLat,
        area_hectares,
      );
      boundaryQuality = BoundaryQuality.MEDIUM;
    }

    const projectId = formatId(name);

    // 3. Create CarbonProject, Boundary, and Holding in Database
    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.carbonProject.create({
        data: {
          id: projectId,
          portfolioId: portfolio.id,
          name,
          description:
            description || `Uploaded ${project_type} carbon intelligence asset`,
          registryId: `VCS-${Math.floor(1000 + Math.random() * 9000)}`,
          methodology:
            project_type === "CONSERVATION" ? "VM0007" : "AR-ACM0003",
          countryCode: country_code || "IN",
          centroidLng,
          centroidLat,
        },
      });

      await tx.projectBoundary.create({
        data: {
          projectId: p.id,
          version: 1,
          geojson: geojsonPayload as unknown as import("@prisma/client").Prisma.InputJsonValue,
          source: "Uploaded GeoJSON / Shapefile Verification",
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

      return p;
    });

    return successResponse(
      {
        id: project.id,
        name: project.name,
        areaHa: measuredAreaHa,
        claimedCarbon: claimed_tco2e,
        centroid: [centroidLng, centroidLat],
        quality: boundaryQuality,
      },
      201,
    );
  } catch (error) {
    console.error("[ProjectAPI] Failed to submit project", error);
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
