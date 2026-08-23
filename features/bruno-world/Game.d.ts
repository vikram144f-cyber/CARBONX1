import type { Camera, Scene } from "three";

export class Game {
  static getInstance(): Game;
  static configure(options?: { scene?: Scene; camera?: Camera; domElement?: HTMLCanvasElement; width?: number; height?: number }): Game;
  scene: Scene | null;
  camera: Camera | null;
  domElement: HTMLCanvasElement | null;
  canvasElement: HTMLCanvasElement | null;
  player: { position: { x: number; y: number; z: number }; position2: { x: number; y: number } };
  inputs: {
    pointer: { current: { x: number; y: number }; delta: { x: number; y: number } };
    actions: Map<string, unknown>;
    addActions: (actions?: Array<{ name: string }>) => void;
  };
  view: { camera: Camera | null; focusPoint: { position: { x: number; y: number; z: number } }; optimalArea: { radius: number } };
  tick(delta: number): void;
}
