"use client";

import { Html, Line, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import type { ColorRepresentation, Group } from "three";
import { Color, Vector3 } from "three";
import { CARBONX_THEME } from "../../lib/theme";

import {
  type WorldDestination,
  type WorldDestinationId,
  type WorldState,
  WORLD_DESTINATIONS,
} from "./navigation-state";
import { Game } from "../bruno-world/Game.js";
import { RayCursor } from "../bruno-world/RayCursor.js";
import { Zones } from "../bruno-world/Zones.js";
import { FolioActionInput } from "./folio-controls";
import { stepRover, type RoverBounds, type RoverState } from "./rover-drive";

const WORLD_BOUNDS: RoverBounds = { minX: -26, maxX: 26, minZ: -26, maxZ: 26 };

type WorldSceneProps = {
  state: WorldState;
  introActive: boolean;
  nearbyId: WorldDestinationId | null;
  onNearbyChange: (destination: WorldDestination | null) => void;
  onInteract: (destination: WorldDestinationId) => void;
};

type BrunoRuntime = {
  game: Game;
  rayCursor: RayCursor;
  zones: Zones;
  zoneById: Map<WorldDestinationId, { id: WorldDestinationId; events: { on: (name: string, callback: (zone: unknown) => void) => unknown; off: (name: string, callback: (zone: unknown) => void) => unknown } }>;
};

const BrunoRuntimeContext = createContext<BrunoRuntime | null>(null);

function useBrunoRuntime(): BrunoRuntime {
  const runtime = useContext(BrunoRuntimeContext);
  if (!runtime) throw new Error("Bruno runtime is unavailable outside the world canvas.");
  return runtime;
}

function BrunoRuntime({ children }: { children: ReactNode }) {
  const { camera, gl, scene, size } = useThree();
  const runtime = useMemo(() => {
    const game = Game.configure({ scene, camera, domElement: gl.domElement, width: size.width, height: size.height });
    const zones = new Zones(game);
    const zoneById = new Map<WorldDestinationId, { id: WorldDestinationId; events: { on: (name: string, callback: (zone: unknown) => void) => unknown; off: (name: string, callback: (zone: unknown) => void) => unknown } }>();
    for (const destination of WORLD_DESTINATIONS) {
      const zone = zones.create("cylinder", new Vector3(...destination.position), destination.radius) as { id: WorldDestinationId; events: { on: (name: string, callback: (zone: unknown) => void) => unknown; off: (name: string, callback: (zone: unknown) => void) => unknown } };
      zone.id = destination.id;
      zoneById.set(destination.id, zone);
    }
    return { game, rayCursor: new RayCursor(), zones, zoneById };
  }, [camera, gl.domElement, scene, size.height, size.width]);

  useEffect(() => {
    const element = gl.domElement;
    const updatePointer = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect();
      const next = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      runtime.game.inputs.pointer.delta.x = next.x - runtime.game.inputs.pointer.current.x;
      runtime.game.inputs.pointer.delta.y = next.y - runtime.game.inputs.pointer.current.y;
      runtime.game.inputs.pointer.current.x = next.x;
      runtime.game.inputs.pointer.current.y = next.y;
    };
    const onDown = (event: PointerEvent) => { updatePointer(event); runtime.rayCursor.testIntersects("start"); };
    const onMove = (event: PointerEvent) => { updatePointer(event); runtime.rayCursor.testIntersects("change"); };
    const onUp = (event: PointerEvent) => { updatePointer(event); runtime.rayCursor.testIntersects("end"); };
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
    };
  }, [gl.domElement, runtime]);

  return <BrunoRuntimeContext.Provider value={runtime}>{children}</BrunoRuntimeContext.Provider>;
}

const treePositions: Array<[number, number]> = [
  [-23, -19], [-20, -14], [-22, -6], [-19, 2], [-22, 7], [-19, 20],
  [-10, -23], [-3, -23], [5, -23], [12, -22], [22, -18], [22, -11],
  [23, -3], [22, 6], [21, 18], [13, 23], [5, 22], [-6, 22],
];

function Terrain() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[58, 58, 24, 24]} />
        <meshStandardMaterial color={CARBONX_THEME.worldTerrain} roughness={0.92} metalness={0.04} />
      </mesh>
      <gridHelper args={[52, 26, CARBONX_THEME.worldGrid, CARBONX_THEME.worldGridDark]} position={[0, -0.27, 0]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.2, 0]}>
        <ringGeometry args={[23.8, 24.2, 64]} />
        <meshBasicMaterial color={CARBONX_THEME.worldGlow} transparent opacity={0.55} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.24, 0]}>
        <circleGeometry args={[8.5, 64]} />
        <meshStandardMaterial color={CARBONX_THEME.purple} emissive={CARBONX_THEME.plum} emissiveIntensity={0.35} roughness={0.8} />
      </mesh>
    </>
  );
}

function Trees() {
  return (
    <group>
      {treePositions.map(([x, z], index) => (
        <group key={`${x}-${z}`} position={[x, 0, z]} scale={0.75 + (index % 3) * 0.12}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.22, 2.2, 6]} />
            <meshStandardMaterial color={CARBONX_THEME.rose} roughness={1} />
          </mesh>
          <mesh position={[0, 2.45, 0]} castShadow>
            <coneGeometry args={[1.05, 2.8, 7]} />
            <meshStandardMaterial color={index % 2 ? CARBONX_THEME.purple : CARBONX_THEME.plum} roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function OperationsRoads() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.16, 0]}>
        <planeGeometry args={[2.2, 50]} />
        <meshStandardMaterial color={CARBONX_THEME.plum} roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.15, 0]}>
        <planeGeometry args={[50, 2.2]} />
        <meshStandardMaterial color={CARBONX_THEME.plum} roughness={0.9} />
      </mesh>
      <Line points={[[-25, -0.05, 0], [25, -0.05, 0]]} color={CARBONX_THEME.worldGlowSoft} lineWidth={1} transparent opacity={0.55} />
      <Line points={[[0, -0.04, -25], [0, -0.04, 25]]} color={CARBONX_THEME.worldGlowSoft} lineWidth={1} transparent opacity={0.55} />
    </group>
  );
}

function NavigationHub() {
  const rotatingRef = useRef<Group | null>(null);
  useFrame(({ clock }) => {
    if (rotatingRef.current) rotatingRef.current.rotation.y = clock.elapsedTime * 0.18;
  });
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[2.5, 3.2, 0.9, 12]} />
        <meshStandardMaterial color={CARBONX_THEME.purple} metalness={0.25} roughness={0.58} />
      </mesh>
      <mesh position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.08, 0.3, 4.2, 10]} />
        <meshStandardMaterial color={CARBONX_THEME.worldGlowSoft} emissive={CARBONX_THEME.worldGlow} emissiveIntensity={1.5} transparent opacity={0.75} />
      </mesh>
      <group ref={rotatingRef} position={[0, 1.05, 0]}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[3.6, 0.07, 8, 64]} />
          <meshStandardMaterial color={CARBONX_THEME.worldGlowSoft} emissive={CARBONX_THEME.worldGlow} emissiveIntensity={1.2} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} rotation-z={Math.PI / 3}>
          <torusGeometry args={[2.9, 0.035, 8, 64]} />
          <meshBasicMaterial color={CARBONX_THEME.highlight} transparent opacity={0.65} />
        </mesh>
      </group>
      <pointLight position={[0, 3.5, 0]} intensity={2.8} distance={18} color={CARBONX_THEME.worldGlow} />
    </group>
  );
}

function FieldRover({ roverRef }: { roverRef: MutableRefObject<Group | null> }) {
  const wheelRefs = useRef<Array<Group | null>>([]);
  const signalRef = useRef<Group | null>(null);
  useFrame(({ clock }, delta) => {
    const pulse = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.08;
    if (signalRef.current) signalRef.current.scale.setScalar(pulse);
    const speed = Number(roverRef.current?.userData.speed ?? 0);
    wheelRefs.current.forEach((wheel) => {
      if (wheel) wheel.rotation.y -= speed * delta * 2.2;
    });
  });
  return (
    <group ref={roverRef} position={[0, 0.34, 5]}>
      <group rotation-y={Math.PI}>
        <mesh position={[0, 0.43, 0]} castShadow>
          <boxGeometry args={[1.7, 0.48, 2.55]} />
          <meshStandardMaterial color={CARBONX_THEME.backgroundDeep} metalness={0.68} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.82, -0.12]} castShadow>
          <boxGeometry args={[1.24, 0.46, 1.25]} />
          <meshStandardMaterial color={CARBONX_THEME.purple} metalness={0.45} roughness={0.27} />
        </mesh>
        <mesh position={[0, 0.88, -0.12]}>
          <boxGeometry args={[1.11, 0.32, 1.07]} />
          <meshStandardMaterial color={CARBONX_THEME.highlight} emissive={CARBONX_THEME.worldGlow} emissiveIntensity={0.22} transparent opacity={0.4} />
        </mesh>
        {([-0.94, 0.94] as const).flatMap((x) => ([-0.78, 0.78] as const).map((z) => [x, z] as const)).map(([x, z], index) => (
          <group key={`${x}-${z}`} ref={(node) => { wheelRefs.current[index] = node; }} position={[x, 0.22, z]} rotation-x={Math.PI / 2}>
            <mesh castShadow>
              <cylinderGeometry args={[0.37, 0.37, 0.24, 12]} />
              <meshStandardMaterial color={CARBONX_THEME.backgroundDeep} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0, 0.13]}>
              <cylinderGeometry args={[0.13, 0.13, 0.26, 12]} />
            <meshStandardMaterial color={CARBONX_THEME.highlight} emissive={CARBONX_THEME.worldGlow} emissiveIntensity={0.32} metalness={0.7} />
            </mesh>
          </group>
        ))}
        <group ref={signalRef} position={[0, 1.32, 0.52]}>
          <mesh>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color={CARBONX_THEME.warning} emissive={CARBONX_THEME.accent} emissiveIntensity={2.5} />
          </mesh>
          <pointLight color={CARBONX_THEME.warning} intensity={1.35} distance={5} />
        </group>
        <mesh position={[0, 0.48, 1.3]}>
          <boxGeometry args={[1.12, 0.13, 0.08]} />
          <meshStandardMaterial color={CARBONX_THEME.highlight} emissive={CARBONX_THEME.accent} emissiveIntensity={0.85} />
        </mesh>
      </group>
    </group>
  );
}

function Observatory({ color }: { color: ColorRepresentation }) {
  return (
    <group>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[2.2, 2.5, 2.2, 8]} />
        <meshStandardMaterial color={CARBONX_THEME.purple} roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.55, 0]} castShadow>
        <sphereGeometry args={[1.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.16} transparent opacity={0.78} />
      </mesh>
      <mesh position={[0, 4.1, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.08, 0.08, 3.2, 8]} />
        <meshStandardMaterial color={CARBONX_THEME.highlight} emissive={CARBONX_THEME.accent} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

function Archive({ color }: { color: ColorRepresentation }) {
  return (
    <group>
      {[-1.4, 0, 1.4].map((x, index) => (
        <mesh key={x} position={[x, 1.2 + (index % 2) * 0.45, 0]} castShadow>
          <boxGeometry args={[1.05, 2.4 + (index % 2) * 0.9, 2.2]} />
          <meshStandardMaterial color={CARBONX_THEME.purple} roughness={0.65} metalness={0.25} />
        </mesh>
      ))}
      <Line points={[[-2.1, 2.8, 1.12], [2.1, 2.8, 1.12]]} color={color} lineWidth={2} />
    </group>
  );
}

function CommandCenter({ color }: { color: ColorRepresentation }) {
  return (
    <group>
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[3.8, 2.6, 3]} />
        <meshStandardMaterial color={CARBONX_THEME.backgroundDeep} roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.5, 0]} castShadow>
        <cylinderGeometry args={[0.7, 1.1, 2.1, 8]} />
        <meshStandardMaterial color={CARBONX_THEME.plum} roughness={0.65} />
      </mesh>
      <mesh position={[0, 4.7, 0]}>
        <sphereGeometry args={[0.34, 12, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

function EvidenceStation({ color }: { color: ColorRepresentation }) {
  return (
    <group>
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[3.4, 2.5, 2.7]} />
        <meshStandardMaterial color={CARBONX_THEME.purple} roughness={0.66} metalness={0.25} />
      </mesh>
      <mesh position={[0, 2.75, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[2.2, 1.2]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
      <mesh position={[0, 3.55, 0]}>
        <torusGeometry args={[0.7, 0.08, 8, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

function AuditBeacon({ color }: { color: ColorRepresentation }) {
  return (
    <group>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.25, 3, 8]} />
        <meshStandardMaterial color={CARBONX_THEME.rose} roughness={0.75} />
      </mesh>
      <mesh position={[0, 3.4, 0]}>
        <torusGeometry args={[1.1, 0.1, 8, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
      </mesh>
    </group>
  );
}

function InvestigationRing({ color }: { color: ColorRepresentation }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[2.5, 0.12, 8, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <torusGeometry args={[1.45, 0.06, 8, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function DestinationStructure({ destination }: { destination: WorldDestination }) {
  const color = new Color(destination.accent);
  if (destination.id === "portfolio") return <Observatory color={color} />;
  if (destination.id === "projects") return <Archive color={color} />;
  if (destination.id === "incidents") return <CommandCenter color={color} />;
  if (destination.id === "evidence") return <EvidenceStation color={color} />;
  if (destination.id === "audit") return <AuditBeacon color={color} />;
  return <InvestigationRing color={color} />;
}

function InteractionZone({
  destination,
  nearby,
  onInteract,
}: {
  destination: WorldDestination;
  nearby: boolean;
  onInteract: (id: WorldDestinationId) => void;
}) {
  const { rayCursor } = useBrunoRuntime();
  const beaconRef = useRef<Group | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const intersectRef = useRef<{ active: boolean } | null>(null);
  useEffect(() => {
    if (!meshRef.current) return;
    const intersect = rayCursor.addIntersect({
      active: nearby,
      shape: meshRef.current,
      onClick: () => { if (nearby) onInteract(destination.id); },
    });
    intersectRef.current = intersect;
    return () => rayCursor.removeIntersect(intersect);
  }, [destination.id, nearby, onInteract, rayCursor]);
  useEffect(() => {
    if (intersectRef.current) intersectRef.current.active = nearby;
  }, [nearby]);
  useFrame(({ clock }) => {
    if (!beaconRef.current) return;
    beaconRef.current.rotation.y = clock.elapsedTime * (nearby ? 0.75 : 0.28);
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.7 + destination.position[0]) * 0.045;
    beaconRef.current.scale.setScalar(pulse);
  });
  return (
    <group position={destination.position}>
      <mesh ref={meshRef} position={[0, 1.7, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 3.7, 16, 1, true]} />
        <meshBasicMaterial color={destination.accent} transparent opacity={nearby ? 0.16 : 0.035} wireframe />
      </mesh>
      <DestinationStructure destination={destination} />
      <group ref={beaconRef} position={[0, 0.08, 0]}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[3.05, nearby ? 0.09 : 0.045, 8, 48]} />
          <meshBasicMaterial color={destination.accent} transparent opacity={nearby ? 0.95 : 0.45} />
        </mesh>
        <mesh position={[0, 2.5, 0]}>
          <cylinderGeometry args={[0.018, 0.055, 5, 6]} />
          <meshBasicMaterial color={destination.accent} transparent opacity={nearby ? 0.75 : 0.22} />
        </mesh>
      </group>
      {nearby ? (
        <Html position={[0, 5.2, 0]} center distanceFactor={28}>
          <div className="cx-surface-elevated pointer-events-none whitespace-nowrap rounded-xl px-3 py-2 text-white shadow-xl backdrop-blur-md">
            <div className="text-[8px] font-semibold uppercase tracking-[0.2em]" style={{ color: destination.accent }}>{destination.eyebrow}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">{destination.label}</div>
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function PlayerController({
  enabled,
  nearbyId,
  onNearbyChange,
  onInteract,
}: {
  enabled: boolean;
  nearbyId: WorldDestinationId | null;
  onNearbyChange: (destination: WorldDestination | null) => void;
  onInteract: (id: WorldDestinationId) => void;
}) {
  const { camera, gl } = useThree();
  const { game, zoneById } = useBrunoRuntime();
  const inputRef = useRef<FolioActionInput | null>(null);
  const roverRef = useRef<Group | null>(null);
  const rover = useRef<RoverState>({ position: [0, 0.34, 5], heading: 0, speed: 0, steering: 0 });
  const focusPoint = useRef(new Vector3(0, 1.1, 5));
  const cameraPosition = useRef(new Vector3(0, 6.7, 14));
  const orbitYaw = useRef(0);
  const orbitPitch = useRef(0.42);
  const dragPointer = useRef<{ x: number; y: number } | null>(null);
  const nearbyRef = useRef<WorldDestinationId | null>(nearbyId);
  useEffect(() => { nearbyRef.current = nearbyId; }, [nearbyId]);
  useEffect(() => {
    const subscriptions = WORLD_DESTINATIONS.map((destination) => {
      const zone = zoneById.get(destination.id);
      if (!zone) return null;
      const onEnter = () => {
        nearbyRef.current = destination.id;
        onNearbyChange(destination);
      };
      const onLeave = () => {
        if (nearbyRef.current === destination.id) {
          nearbyRef.current = null;
          onNearbyChange(null);
        }
      };
      zone.events.on("enter", onEnter);
      zone.events.on("leave", onLeave);
      return () => { zone.events.off("enter", onEnter); zone.events.off("leave", onLeave); };
    });
    return () => subscriptions.forEach((unsubscribe) => unsubscribe?.());
  }, [onNearbyChange, zoneById]);
  useEffect(() => {
    if (!enabled) {
      inputRef.current?.dispose();
      inputRef.current = null;
      dragPointer.current = null;
      return;
    }
    const input = new FolioActionInput();
    inputRef.current = input;
    const removeAction = input.onStart((action) => {
      if (action === "interact" && nearbyRef.current) onInteract(nearbyRef.current);
    });
    const onPointerDown = (event: PointerEvent) => {
      dragPointer.current = { x: event.clientX, y: event.clientY };
      gl.domElement.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const previous = dragPointer.current;
      if (!previous) return;
      const deltaX = event.clientX - previous.x;
      const deltaY = event.clientY - previous.y;
      orbitYaw.current -= deltaX * 0.007;
      orbitPitch.current = Math.max(0.22, Math.min(0.8, orbitPitch.current + deltaY * 0.005));
      dragPointer.current = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      dragPointer.current = null;
      if (gl.domElement.hasPointerCapture?.(event.pointerId)) gl.domElement.releasePointerCapture(event.pointerId);
    };
    gl.domElement.addEventListener("pointerdown", onPointerDown);
    gl.domElement.addEventListener("pointermove", onPointerMove);
    gl.domElement.addEventListener("pointerup", onPointerUp);
    return () => {
      removeAction();
      input.dispose();
      inputRef.current = null;
      gl.domElement.removeEventListener("pointerdown", onPointerDown);
      gl.domElement.removeEventListener("pointermove", onPointerMove);
      gl.domElement.removeEventListener("pointerup", onPointerUp);
    };
  }, [enabled, gl.domElement, onInteract]);
  useFrame((_state, delta) => {
    const input = inputRef.current;
    if (enabled && input) {
      rover.current = stepRover(rover.current, {
        forward: input.isActive("forward"),
        backward: input.isActive("backward"),
        left: input.isActive("left"),
        right: input.isActive("right"),
        boost: input.isActive("boost"),
        brake: input.isActive("brake"),
      }, delta, WORLD_BOUNDS);
    }
    const current = rover.current;
    if (roverRef.current) {
      roverRef.current.position.set(...current.position);
      roverRef.current.rotation.y = current.heading;
      roverRef.current.rotation.z = -current.steering * Math.min(0.12, Math.abs(current.speed) * 0.014);
      roverRef.current.userData.speed = current.speed;
    }
    game.player.position.x = current.position[0];
    game.player.position.y = current.position[1];
    game.player.position.z = current.position[2];
    game.player.position2.x = current.position[0];
    game.player.position2.y = current.position[2];
    game.view.focusPoint.position.x = current.position[0];
    game.view.focusPoint.position.y = current.position[1] + 1;
    game.view.focusPoint.position.z = current.position[2];
    focusPoint.current.lerp(new Vector3(current.position[0], current.position[1] + 1.1, current.position[2]), 1 - Math.exp(-8 * Math.min(delta, 0.05)));
    if (!dragPointer.current) orbitYaw.current *= Math.exp(-1.2 * Math.min(delta, 0.05));
    const cameraHeading = current.heading + orbitYaw.current;
    const distance = 9.2;
    const horizontal = Math.cos(orbitPitch.current) * distance;
    const targetCameraPosition = new Vector3(
      focusPoint.current.x - Math.sin(cameraHeading) * horizontal,
      focusPoint.current.y + Math.sin(orbitPitch.current) * distance + 0.6,
      focusPoint.current.z + Math.cos(cameraHeading) * horizontal,
    );
    cameraPosition.current.lerp(targetCameraPosition, 1 - Math.exp(-6.5 * Math.min(delta, 0.05)));
    camera.position.copy(cameraPosition.current);
    camera.lookAt(focusPoint.current);
    game.tick(delta);
  });
  return <FieldRover roverRef={roverRef} />;
}

function WorldSceneContents({ state, introActive, nearbyId, onNearbyChange, onInteract }: WorldSceneProps) {
  const destinations = useMemo(() => WORLD_DESTINATIONS, []);
  return (
    <BrunoRuntime>
      <color attach="background" args={[CARBONX_THEME.worldFog]} />
      <fog attach="fog" args={[CARBONX_THEME.worldFog, 30, 82]} />
      <hemisphereLight args={[CARBONX_THEME.highlight, CARBONX_THEME.backgroundDeep, 1.45]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-12, 24, 9]} intensity={2.7} color={CARBONX_THEME.highlight} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 9, 0]} intensity={2.2} distance={38} color={CARBONX_THEME.worldGlow} />
      <Terrain />
      <OperationsRoads />
      <NavigationHub />
      <Trees />
      <Sparkles count={95} scale={[48, 10, 48]} size={1.35} speed={0.12} opacity={0.3} color={CARBONX_THEME.highlight} />
      {destinations.map((destination) => <InteractionZone key={destination.id} destination={destination} nearby={nearbyId === destination.id} onInteract={onInteract} />)}
      <PlayerController enabled={!introActive} nearbyId={nearbyId} onNearbyChange={onNearbyChange} onInteract={onInteract} />
    </BrunoRuntime>
  );
}

export function CarbonWorldScene(props: WorldSceneProps) {
  return (
    <div className="absolute inset-0" style={{ height: "100%", inset: 0, position: "absolute", width: "100%" }}>
      <Canvas style={{ display: "block", height: "100%", width: "100%" }} camera={{ position: [0, 6.7, 14], fov: 48 }} dpr={[1, 1.4]} gl={{ antialias: true, powerPreference: "high-performance" }} shadows>
        <WorldSceneContents {...props} />
      </Canvas>
    </div>
  );
}
