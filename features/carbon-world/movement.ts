export type PlayerPosition = [number, number, number];

export type MovementInput = {
  forward: number;
  strafe: number;
};

export type WorldBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function clampWorldPosition(
  position: PlayerPosition,
  bounds: WorldBounds,
): PlayerPosition {
  return [
    Math.min(bounds.maxX, Math.max(bounds.minX, position[0])),
    position[1],
    Math.min(bounds.maxZ, Math.max(bounds.minZ, position[2])),
  ];
}

export function normalizeMovementInput(input: MovementInput): MovementInput {
  const length = Math.hypot(input.forward, input.strafe);
  if (length === 0) return { forward: 0, strafe: 0 };
  return { forward: input.forward / length, strafe: input.strafe / length };
}

export function stepPlayer(
  position: PlayerPosition,
  velocity: MovementInput,
  input: MovementInput,
  yaw: number,
  deltaSeconds: number,
  bounds: WorldBounds,
): { position: PlayerPosition; velocity: MovementInput } {
  const delta = Math.min(0.05, Math.max(0, deltaSeconds));
  const normalized = normalizeMovementInput(input);
  const target = {
    forward: normalized.forward * 9,
    strafe: normalized.strafe * 9,
  };
  const smoothing = 1 - Math.exp(-12 * delta);
  const nextVelocity = {
    forward: velocity.forward + (target.forward - velocity.forward) * smoothing,
    strafe: velocity.strafe + (target.strafe - velocity.strafe) * smoothing,
  };
  const next: PlayerPosition = [
    position[0] + (Math.sin(yaw) * nextVelocity.forward + Math.cos(yaw) * nextVelocity.strafe) * delta,
    position[1],
    position[2] + (-Math.cos(yaw) * nextVelocity.forward + Math.sin(yaw) * nextVelocity.strafe) * delta,
  ];
  return {
    position: clampWorldPosition(next, bounds),
    velocity: nextVelocity,
  };
}
