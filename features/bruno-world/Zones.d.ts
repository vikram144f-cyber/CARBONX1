import type { Vector3 } from "three";

type ZoneEvent = {
  on(name: string, callback: (zone: Zone) => void): unknown;
  off(name: string, callback: (zone: Zone) => void): unknown;
};

export type Zone = { id?: string; type: string; position: Vector3; radius: number; isIn: boolean; events: ZoneEvent; preview: unknown };

export class Zones {
  constructor(game?: unknown);
  create(type: string, position: Vector3, radius: number): Zone;
}
