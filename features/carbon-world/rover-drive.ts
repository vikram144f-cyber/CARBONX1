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
  const maxForwardSpeed = input.boost ? 15 : 9;
  const maxReverseSpeed = -4.5;
  const acceleration = throttle * (throttle < 0 ? 12 : input.boost ? 19 : 14);
  const rollingDrag = throttle === 0 ? 5.6 : 1.15;
  let speed = state.speed + acceleration * delta;
  if (throttle === 0) speed -= Math.sign(speed) * Math.min(Math.abs(speed), rollingDrag * delta);
  if (input.brake) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 20 * delta);
  speed = clamp(speed, maxReverseSpeed, maxForwardSpeed);

  const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const steerAmount = Math.min(1, Math.abs(speed) / 4.5);
  const targetSteering = steerInput * steerAmount;
  const steering = state.steering + (targetSteering - state.steering) * (1 - Math.exp(-9 * delta));
  const direction = speed >= 0 ? 1 : -1;
  const heading = state.heading + steering * direction * Math.min(1, Math.abs(speed) / 6) * 1.75 * delta;
  const nextPosition: RoverPosition = [
    clamp(state.position[0] + Math.sin(heading) * speed * delta, bounds.minX, bounds.maxX),
    state.position[1],
    clamp(state.position[2] - Math.cos(heading) * speed * delta, bounds.minZ, bounds.maxZ),
  ];

  return { position: nextPosition, heading, speed, steering };
}
