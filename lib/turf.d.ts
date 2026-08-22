declare module "@turf/turf" {
  import type { Feature, MultiPolygon, Point, Polygon } from "geojson";

  type TurfFeature = {
    type: "Feature";
    properties?: unknown;
    geometry: { type: string; coordinates: unknown };
  };

  export function area(geojson: unknown): number;
  export function centroid(geojson: unknown): {
    geometry: { coordinates: [number, number] };
  };
  export function point(coordinates: [number, number]): Feature<Point>;
  export function polygon(coordinates: number[][][]): Feature<Polygon>;
  export function buffer(
    geojson: unknown,
    radius: number,
    options: { units: string },
  ): Feature<Polygon | MultiPolygon> | null;
  export function intersect(
    first: unknown,
    second: unknown,
  ): Feature<Polygon | MultiPolygon> | null;
}

declare module "@turf/boolean-valid" {
  const booleanValid: (feature: unknown) => boolean;
  export default booleanValid;
}
