export type ScenePoint = [number, number];

export type SceneBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type SceneRing = ScenePoint[];

type Coordinate = [number, number];

const METERS_PER_DEGREE_LATITUDE = 111_320;

function isCoordinate(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function projectPoint(
  coordinate: Coordinate,
  centroid: Coordinate,
  sceneScale: number,
): ScenePoint {
  const latitudeScale = Math.max(0.2, Math.cos((centroid[1] * Math.PI) / 180));
  const metersEast = (coordinate[0] - centroid[0]) * METERS_PER_DEGREE_LATITUDE * latitudeScale;
  const metersNorth = (coordinate[1] - centroid[1]) * METERS_PER_DEGREE_LATITUDE;
  return [metersEast * sceneScale, -metersNorth * sceneScale];
}

function collectRings(value: unknown, output: Coordinate[][]): void {
  if (!Array.isArray(value) || value.length === 0) return;
  if (value.every(isCoordinate)) {
    output.push(value);
    return;
  }
  for (const child of value) collectRings(child, output);
}

function geometryCoordinates(geometry: unknown): unknown {
  if (!geometry || typeof geometry !== "object" || Array.isArray(geometry)) return null;
  const candidate = geometry as { type?: unknown; geometry?: unknown; coordinates?: unknown };
  if (candidate.type === "Feature") {
    return candidate.geometry && typeof candidate.geometry === "object"
      ? (candidate.geometry as { coordinates?: unknown }).coordinates
      : null;
  }
  return candidate.coordinates;
}

export function projectBoundaryToScene(
  geometry: unknown,
  centroid: Coordinate,
  sceneScale = 0.001,
): SceneRing[] {
  const rings: Coordinate[][] = [];
  collectRings(geometryCoordinates(geometry), rings);
  return rings
    .map((ring) => ring.map((coordinate) => projectPoint(coordinate, centroid, sceneScale)))
    .filter((ring) => ring.length >= 3);
}

export function projectPointToScene(
  coordinate: Coordinate | null,
  centroid: Coordinate,
  sceneScale = 0.001,
): ScenePoint | null {
  return coordinate ? projectPoint(coordinate, centroid, sceneScale) : null;
}

export function calculateSceneBounds(
  rings: SceneRing[],
  padding = 3,
): SceneBounds {
  const points = rings.flat();
  if (points.length === 0) {
    return { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
  }
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  return {
    minX: Math.min(...xs) - padding,
    maxX: Math.max(...xs) + padding,
    minZ: Math.min(...zs) - padding,
    maxZ: Math.max(...zs) + padding,
  };
}

export function clampScenePosition(
  position: [number, number, number],
  bounds: SceneBounds,
  heightRange: [number, number] = [1.5, 18],
): [number, number, number] {
  return [
    Math.min(bounds.maxX, Math.max(bounds.minX, position[0])),
    Math.min(heightRange[1], Math.max(heightRange[0], position[1])),
    Math.min(bounds.maxZ, Math.max(bounds.minZ, position[2])),
  ];
}
