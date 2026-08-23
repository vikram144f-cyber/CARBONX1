/**
 * CARBONX input adapter based on Bruno Simon's folio-2025 input action model.
 *
 * Adapted from:
 * - sources/Game/Inputs/Keyboard.js
 * - sources/Game/Inputs/Inputs.js
 *
 * Copyright (c) 2025 Bruno Simon. MIT License. The complete license notice is
 * retained in bruno-simon-license.md.
 *
 * folio-2025's implementation is tied to its Game singleton, gamepad and
 * touch UI. This browser-only adapter keeps its important behaviour: actions
 * are mapped from physical keys, support several simultaneously-held keys,
 * and reset cleanly when the window loses focus.
 */

export type FolioActionName =
  | "forward"
  | "backward"
  | "left"
  | "right"
  | "boost"
  | "brake"
  | "interact";

type FolioAction = {
  active: boolean;
  activeKeys: Set<string>;
  keys: readonly string[];
};

const ACTIONS: Record<FolioActionName, readonly string[]> = {
  forward: ["KeyW", "ArrowUp"],
  backward: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  boost: ["ShiftLeft", "ShiftRight"],
  brake: ["Space"],
  interact: ["KeyE", "Enter"],
};

type ActionListener = (action: FolioActionName) => void;

export class FolioActionInput {
  private readonly actions = new Map<FolioActionName, FolioAction>();
  private readonly startListeners = new Set<ActionListener>();
  private readonly target: Window;
  private readonly onKeyDownBound: (event: KeyboardEvent) => void;
  private readonly onKeyUpBound: (event: KeyboardEvent) => void;
  private readonly onBlurBound: () => void;

  constructor(target: Window = window) {
    this.target = target;
    (Object.keys(ACTIONS) as FolioActionName[]).forEach((name) => {
      this.actions.set(name, { active: false, activeKeys: new Set<string>(), keys: ACTIONS[name] });
    });

    this.onKeyDownBound = (event) => this.handleKeyDown(event);
    this.onKeyUpBound = (event) => this.handleKeyUp(event);
    this.onBlurBound = () => this.reset();
    target.addEventListener("keydown", this.onKeyDownBound);
    target.addEventListener("keyup", this.onKeyUpBound);
    target.addEventListener("blur", this.onBlurBound);
  }

  isActive(name: FolioActionName): boolean {
    return this.actions.get(name)?.active ?? false;
  }

  onStart(listener: ActionListener): () => void {
    this.startListeners.add(listener);
    return () => this.startListeners.delete(listener);
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDownBound);
    this.target.removeEventListener("keyup", this.onKeyUpBound);
    this.target.removeEventListener("blur", this.onBlurBound);
    this.reset();
    this.startListeners.clear();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const activeElement = document.activeElement;
    if (activeElement?.matches("input, textarea, select, [contenteditable]") && event.code !== "Escape") return;

    this.actions.forEach((action, name) => {
      if (!action.keys.includes(event.code)) return;
      const wasActive = action.active;
      action.activeKeys.add(event.code);
      action.active = true;
      if (!wasActive) this.startListeners.forEach((listener) => listener(name));
    });
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.actions.forEach((action) => {
      if (!action.keys.includes(event.code)) return;
      action.activeKeys.delete(event.code);
      action.active = action.activeKeys.size > 0;
    });
  }

  private reset(): void {
    this.actions.forEach((action) => {
      action.activeKeys.clear();
      action.active = false;
    });
  }
}
