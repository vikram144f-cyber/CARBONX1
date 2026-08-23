import assert from "node:assert/strict";
import test from "node:test";

import {
  getNearbyDestination,
  resolveWorldRoute,
  worldStatusLine,
  type WorldState,
} from "../features/carbon-world/navigation-state";
import {
  clampWorldPosition,
  normalizeMovementInput,
  stepPlayer,
} from "../features/carbon-world/movement";
import { BrunoZoneManager } from "../features/carbon-world/bruno-simon-adapter";
import { stepRover } from "../features/carbon-world/rover-drive";

const emptyState: WorldState = {
  projectCount: 2,
  activeIncidentCount: 0,
  incidents: [],
  systemReady: true,
};

test("world proximity returns the nearest station only inside its interaction radius", () => {
  assert.equal(getNearbyDestination([-15, 2, -9])?.id, "portfolio");
  assert.equal(getNearbyDestination([-15, 2, -9.1])?.id, "portfolio");
  assert.equal(getNearbyDestination([0, 2, 0]), null);
});

test("zero-incident destinations never fabricate an incident route", () => {
  assert.equal(resolveWorldRoute("incidents", emptyState), "/?mode=command&focus=incidents");
  assert.equal(resolveWorldRoute("audit", emptyState), "/?mode=command&focus=incidents");
  assert.equal(resolveWorldRoute("investigation", emptyState), "/?mode=command&focus=incidents");
});

test("incident destinations use the real incident id when one exists", () => {
  const state: WorldState = { ...emptyState, activeIncidentCount: 1, incidents: [{ id: "incident/real", status: "UNDER_ASSESSMENT" }] };
  assert.equal(resolveWorldRoute("incidents", state), "/incidents/incident%2Freal");
  assert.equal(resolveWorldRoute("investigation", state), "/incidents/incident%2Freal?mode=3d");
});

test("world status line reflects backend counts", () => {
  assert.equal(worldStatusLine(emptyState), "2 projects monitored · 0 active incidents");
  assert.equal(
    worldStatusLine({ ...emptyState, projectCount: null, activeIncidentCount: null, systemReady: false }),
    "Syncing live portfolio data…",
  );
});

test("movement normalizes diagonals and respects world bounds", () => {
  const normalized = normalizeMovementInput({ forward: 1, strafe: 1 });
  assert.ok(Math.abs(normalized.forward - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(normalized.strafe - Math.SQRT1_2) < 1e-12);
  assert.deepEqual(clampWorldPosition([99, 2, -99], { minX: -26, maxX: 26, minZ: -26, maxZ: 26 }), [26, 2, -26]);
  const stepped = stepPlayer([0, 2, 0], { forward: 0, strafe: 0 }, { forward: 1, strafe: 0 }, 0, 1 / 60, { minX: -26, maxX: 26, minZ: -26, maxZ: 26 });
  assert.ok(stepped.position[2] < 0);
  assert.ok(stepped.velocity.forward > 0);
});

test("Bruno-style cylindrical zones emit one enter and one leave transition", () => {
  const zones = new BrunoZoneManager();
  zones.create("cylinder", "incident", [4, 12, -2], 2);
  const transitions: string[] = [];
  const update = (position: [number, number, number]) => zones.update(
    position,
    (zone) => transitions.push(`enter:${zone.id}`),
    (zone) => transitions.push(`leave:${zone.id}`),
  );

  update([4, 0, -2]);
  update([4, 100, -2]);
  update([4, 0, -2]);
  update([6, 0, -2]);
  update([5, 0, -2]);
  update([6.01, 0, -2]);

  assert.deepEqual(transitions, ["enter:incident", "leave:incident", "enter:incident", "leave:incident"]);
});

test("folio-style rover controls accelerate, steer, brake, and preserve world bounds", () => {
  const bounds = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  const initial = { position: [0, 0.34, 0] as [number, number, number], heading: 0, speed: 0, steering: 0 };
  const moving = stepRover(initial, { forward: true, backward: false, left: false, right: true, boost: true, brake: false }, 1 / 30, bounds);
  assert.ok(moving.speed > 0);
  assert.ok(moving.steering < 0);
  assert.ok(moving.heading < 0);
  assert.ok(moving.position[2] > 0);

  const left = stepRover(initial, { forward: true, backward: false, left: true, right: false, boost: true, brake: false }, 1 / 30, bounds);
  assert.ok(left.steering > 0);
  assert.ok(left.heading > 0);
  assert.ok(left.position[2] < 0);

  const stopped = stepRover(moving, { forward: false, backward: false, left: false, right: false, boost: false, brake: true }, 1 / 20, bounds);
  assert.ok(stopped.speed < moving.speed);

  const bounded = stepRover({ ...initial, position: [1.99, 0.34, -1.99], speed: 14 }, { forward: true, backward: false, left: false, right: true, boost: true, brake: false }, 1, bounds);
  assert.ok(bounded.position[0] <= bounds.maxX && bounded.position[0] >= bounds.minX);
  assert.ok(bounded.position[2] <= bounds.maxZ && bounded.position[2] >= bounds.minZ);
});
