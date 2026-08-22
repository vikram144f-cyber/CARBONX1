import { z } from "zod";

export const replayEventRequestSchema = z
  .object({
    seedEventId: z.string().trim().min(1).max(128),
  })
  .strict();

export type ReplayEventRequest = z.infer<typeof replayEventRequestSchema>;

const numericValue = z.number().finite();
const position = z.array(numericValue).min(2).max(3);
const linearRing = z
  .array(position)
  .min(4)
  .superRefine((ring, context) => {
    const first = ring[0];
    const last = ring[ring.length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "polygon rings must be closed",
      });
    }
  });

const polygonGeometry = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(linearRing).min(1),
});

const multiPolygonGeometry = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(linearRing).min(1)).min(1),
});

const polygonFeature = z.object({
  type: z.literal("Feature"),
  geometry: z.union([polygonGeometry, multiPolygonGeometry]),
  properties: z.record(z.unknown()).nullable().optional(),
});

export const projectBoundaryGeoJsonSchema = z.union([
  polygonGeometry,
  multiPolygonGeometry,
  polygonFeature,
]);

export const projectBoundaryImportRequestSchema = z
  .object({
    geojson: projectBoundaryGeoJsonSchema,
    source: z.string().trim().min(1).max(200),
    sourceUrl: z.string().trim().url().max(2048).nullable().optional(),
    quality: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  })
  .strict();

export type ProjectBoundaryImportRequest = z.infer<
  typeof projectBoundaryImportRequestSchema
>;
