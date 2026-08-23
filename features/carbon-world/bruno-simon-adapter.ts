/**
 * CARBONX adapter for directly compatible interaction primitives from
 * Bruno Simon's folio-2025 repository.
 *
 * Source modules:
 * - sources/Game/Inputs/Keyboard.js
 * - sources/Game/Zones.js
 *
 * Copyright (c) 2025 Bruno Simon. Licensed under the MIT License; the
 * complete notice is preserved in bruno-simon-license.md.
 *
 * The original modules depend on folio-2025's singleton Game, ticker,
 * WebGPU renderer, and Events implementation. These adapters preserve
 * their keyboard and enter/leave semantics while exposing a small API that
 * can be owned by a React Three Fiber scene.
 */

type KeyboardListener = (code: string, key: string) => void;

export class BrunoKeyboardInput {
  private readonly target: Window;
  private readonly pressed: string[] = [];
  private readonly downListeners = new Set<KeyboardListener>();
  private readonly upListeners = new Set<KeyboardListener>();
  private readonly onKeyDownBound: (event: KeyboardEvent) => void;
  private readonly onKeyUpBound: (event: KeyboardEvent) => void;
  private readonly onBlurBound: () => void;

  constructor(target: Window = window) {
    this.target = target;
    this.onKeyDownBound = (event) => this.handleKeyDown(event);
    this.onKeyUpBound = (event) => this.handleKeyUp(event);
    this.onBlurBound = () => {
      const previous = [...this.pressed];
      this.pressed.length = 0;
      for (const key of previous) {
        this.emit(this.upListeners, key, key);
      }
    };

    target.addEventListener("keydown", this.onKeyDownBound);
    target.addEventListener("keyup", this.onKeyUpBound);
    target.addEventListener("blur", this.onBlurBound);
  }

  onDown(listener: KeyboardListener): () => void {
    this.downListeners.add(listener);
    return () => this.downListeners.delete(listener);
  }

  onUp(listener: KeyboardListener): () => void {
    this.upListeners.add(listener);
    return () => this.upListeners.delete(listener);
  }

  isPressed(...keys: string[]): boolean {
    return keys.some((key) => this.pressed.includes(key));
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDownBound);
    this.target.removeEventListener("keyup", this.onKeyUpBound);
    this.target.removeEventListener("blur", this.onBlurBound);
    this.pressed.length = 0;
    this.downListeners.clear();
    this.upListeners.clear();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const activeElement = document.activeElement;
    if (activeElement?.matches("input, textarea, select, [contenteditable]") && event.code !== "Escape") {
      return;
    }

    this.pressed.push(event.code, event.key);
    this.emit(this.downListeners, event.code, event.key);
  }

  private handleKeyUp(event: KeyboardEvent): void {
    const codeIndex = this.pressed.indexOf(event.code);
    if (codeIndex !== -1) this.pressed.splice(codeIndex, 1);
    const keyIndex = this.pressed.indexOf(event.key);
    if (keyIndex !== -1) this.pressed.splice(keyIndex, 1);
    this.emit(this.upListeners, event.code, event.key);
  }

  private emit(listeners: Set<KeyboardListener>, code: string, key: string): void {
    listeners.forEach((listener) => listener(code, key));
  }
}

export type BrunoZoneType = "sphere" | "cylinder";

export type BrunoZone = {
  id: string;
  type: BrunoZoneType;
  position: readonly [number, number, number];
  radius: number;
  isIn: boolean;
};

type ZoneCallback = (zone: BrunoZone) => void;

/**
 * The source Zones class uses strict radius entry/leave transitions and
 * checks cylindrical zones on the X/Z plane. This keeps that behavior while
 * leaving visual previews to the R3F scene.
 */
export class BrunoZoneManager {
  private readonly items: BrunoZone[] = [];

  create(
    type: BrunoZoneType,
    id: string,
    position: readonly [number, number, number],
    radius: number,
  ): BrunoZone {
    const zone: BrunoZone = { type, id, position, radius, isIn: false };
    this.items.push(zone);
    return zone;
  }

  update(playerPosition: readonly [number, number, number], onEnter: ZoneCallback, onLeave: ZoneCallback): void {
    for (const zone of this.items) {
      const dx = playerPosition[0] - zone.position[0];
      const dy = playerPosition[1] - zone.position[1];
      const dz = playerPosition[2] - zone.position[2];
      const distance = zone.type === "cylinder"
        ? Math.hypot(dx, dz)
        : Math.hypot(dx, dy, dz);

      if (distance < zone.radius) {
        if (!zone.isIn) {
          zone.isIn = true;
          onEnter(zone);
        }
      } else if (zone.isIn) {
        zone.isIn = false;
        onLeave(zone);
      }
    }
  }
}
