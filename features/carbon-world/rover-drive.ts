export type RoverPosition = [number, number, number];

export type RoverBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type RoverInput = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  brake: boolean;
};

export type RoverState = {
  position: RoverPosition;
  heading: number;
  speed: number;
  steering: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function shortestAngle(target: number, current: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function steerTravelAwayFromBoundary(
  heading: number,
  direction: number,
  position: RoverPosition,
  bounds: RoverBounds,
  delta: number,
  throttle: number,
): number {
  if (throttle === 0) return heading;

  const width = Math.max(1, bounds.maxX - bounds.minX);
  const depth = Math.max(1, bounds.maxZ - bounds.minZ);
  const boundaryMargin = Math.min(10, Math.min(width, depth) * 0.12);
  const inwardX = (position[0] > bounds.maxX - boundaryMargin ? -1 : 0)
    + (position[0] < bounds.minX + boundaryMargin ? 1 : 0);
  const inwardZ = (position[2] > bounds.maxZ - boundaryMargin ? -1 : 0)
    + (position[2] < bounds.minZ + boundaryMargin ? 1 : 0);
  if (inwardX === 0 && inwardZ === 0) return heading;

  const inwardLength = Math.hypot(inwardX, inwardZ);
  const travelHeading = Math.atan2(-(inwardZ / inwardLength), inwardX / inwardLength);
  const targetHeading = direction >= 0 ? travelHeading : travelHeading + Math.PI;
  const edgeDistance = Math.min(
    bounds.maxX - position[0],
    position[0] - bounds.minX,
    bounds.maxZ - position[2],
    position[2] - bounds.minZ,
  );
  const edgeStrength = clamp(1 - edgeDistance / boundaryMargin, 0, 1);
  return heading + shortestAngle(targetHeading, heading) * edgeStrength * Math.min(1, delta * 8);
}

/**
 * Vehicle-style motion used by the CARBONX world. It mirrors folio-2025's
 * action split (forward/backward/left/right/boost/brake), while remaining
 * deterministic and independent of a physics engine.
 */
export function stepRover(
  state: RoverState,
  input: RoverInput,
  deltaSeconds: number,
  bounds: RoverBounds,
): RoverState {
  const delta = clamp(deltaSeconds, 0, 0.05);
  const throttle = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const maxForwardSpeed = input.boost ? 21 : 13;
  const maxReverseSpeed = -6;
  const acceleration = throttle * (throttle < 0 ? 15 : input.boost ? 27 : 20);
  const rollingDrag = throttle === 0 ? 6.4 : 1.05;
  let speed = state.speed + acceleration * delta;
  if (throttle === 0) speed -= Math.sign(speed) * Math.min(Math.abs(speed), rollingDrag * delta);
  if (input.brake) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 20 * delta);
  speed = clamp(speed, maxReverseSpeed, maxForwardSpeed);

  // Bruno's PhysicsVehicle uses +X as forward and maps left to positive steering.
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerAmount = Math.min(1, Math.abs(speed) / 4.5);
  const targetSteering = steerInput * steerAmount;
  const steering = state.steering + (targetSteering - state.steering) * (1 - Math.exp(-9 * delta));
  const direction = speed >= 0 ? 1 : -1;
  let heading = state.heading + steering * direction * Math.min(1, Math.abs(speed) / 6) * 1.75 * delta;
  heading = steerTravelAwayFromBoundary(heading, direction, state.position, bounds, delta, throttle);
  heading = Math.atan2(Math.sin(heading), Math.cos(heading));
  const nextPosition: RoverPosition = [
    clamp(state.position[0] + Math.cos(heading) * speed * delta, bounds.minX, bounds.maxX),
    state.position[1],
    clamp(state.position[2] - Math.sin(heading) * speed * delta, bounds.minZ, bounds.maxZ),
  ];

  return { position: nextPosition, heading, speed, steering };
}
