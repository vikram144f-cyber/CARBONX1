import type { Mesh } from "three";

export type RayIntersect = { active: boolean };

export class RayCursor {
  constructor();
  addIntersect(description: { active: boolean; shape: Mesh; onClick?: () => void }): RayIntersect;
  removeIntersect(intersect: RayIntersect): void;
  testIntersects(actionTrigger: "start" | "change" | "end"): void;
}
