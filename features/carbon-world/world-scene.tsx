"use client";

import { Html, Line, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { ColorRepresentation } from "three";
import { Color } from "three";

import {
  getNearbyDestination,
  type WorldDestination,
  type WorldDestinationId,
  type WorldState,
  WORLD_DESTINATIONS,
} from "./navigation-state";
import { stepPlayer, type PlayerPosition, type WorldBounds } from "./movement";

const WORLD_BOUNDS: WorldBounds = { minX: -26, maxX: 26, minZ: -26, maxZ: 26 };

type WorldSceneProps = {
  state: WorldState;
  introActive: boolean;
  nearbyId: WorldDestinationId | null;
  onNearbyChange: (destination: WorldDestination | null) => void;
  onInteract: (destination: WorldDestinationId) => void;
};

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
        <meshStandardMaterial color="#0a2019" roughness={0.96} metalness={0.02} />
      </mesh>
      <gridHelper args={[52, 26, "#183d31", "#0e2c23"]} position={[0, -0.27, 0]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.2, 0]}>
        <ringGeometry args={[23.8, 24.2, 64]} />
        <meshBasicMaterial color="#143e30" transparent opacity={0.7} />
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
            <meshStandardMaterial color="#5f4b36" roughness={1} />
          </mesh>
          <mesh position={[0, 2.45, 0]} castShadow>
            <coneGeometry args={[1.05, 2.8, 7]} />
            <meshStandardMaterial color={index % 2 ? "#173e2b" : "#1b4e35"} roughness={1} />
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
        <meshStandardMaterial color="#102d25" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.15, 0]}>
        <planeGeometry args={[50, 2.2]} />
        <meshStandardMaterial color="#102d25" roughness={1} />
      </mesh>
      <Line points={[[-25, -0.05, 0], [25, -0.05, 0]]} color="#2a6650" lineWidth={1} transparent opacity={0.6} />
      <Line points={[[0, -0.04, -25], [0, -0.04, 25]]} color="#2a6650" lineWidth={1} transparent opacity={0.6} />
    </group>
  );
}

function Observatory({ color }: { color: ColorRepresentation }) {
  return (
    <group>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[2.2, 2.5, 2.2, 8]} />
        <meshStandardMaterial color="#183d32" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.55, 0]} castShadow>
        <sphereGeometry args={[1.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.16} transparent opacity={0.78} />
      </mesh>
      <mesh position={[0, 4.1, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.08, 0.08, 3.2, 8]} />
        <meshStandardMaterial color="#9de7c4" emissive="#6ee7b7" emissiveIntensity={0.25} />
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
          <meshStandardMaterial color="#123b40" roughness={0.65} metalness={0.25} />
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
        <meshStandardMaterial color="#302d27" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.5, 0]} castShadow>
        <cylinderGeometry args={[0.7, 1.1, 2.1, 8]} />
        <meshStandardMaterial color="#473d2b" roughness={0.65} />
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
        <meshStandardMaterial color="#162f3b" roughness={0.66} metalness={0.25} />
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
        <meshStandardMaterial color="#3d2630" roughness={0.75} />
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
  return (
    <group position={destination.position}>
      <mesh onClick={(event) => { event.stopPropagation(); if (nearby) onInteract(destination.id); }} position={[0, 1.7, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 3.7, 16, 1, true]} />
        <meshBasicMaterial color={destination.accent} transparent opacity={nearby ? 0.12 : 0.02} wireframe />
      </mesh>
      <DestinationStructure destination={destination} />
      {nearby ? (
        <Html position={[0, 5.2, 0]} center distanceFactor={13}>
          <div className="pointer-events-none whitespace-nowrap rounded-full border border-white/15 bg-[#07110f]/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100 shadow-xl">
            {destination.label}
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
  const keys = useRef(new Set<string>());
  const position = useRef<PlayerPosition>([0, 2.2, 13]);
  const velocity = useRef({ forward: 0, strafe: 0 });
  const yaw = useRef(0);
  const pitch = useRef(-0.22);
  const nearbyRef = useRef<WorldDestinationId | null>(nearbyId);
  useEffect(() => { nearbyRef.current = nearbyId; }, [nearbyId]);
  useEffect(() => {
    if (!enabled) {
      keys.current.clear();
      velocity.current = { forward: 0, strafe: 0 };
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (typing) return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
      }
      if ((key === "e" || key === "enter") && nearbyRef.current) {
        event.preventDefault();
        onInteract(nearbyRef.current);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const onPointerMove = (event: PointerEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      yaw.current -= event.movementX * 0.0022;
      pitch.current = Math.max(-1.1, Math.min(0.55, pitch.current - event.movementY * 0.0022));
      camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    };
    const onClick = () => { void gl.domElement.requestPointerLock?.(); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    gl.domElement.addEventListener("pointermove", onPointerMove);
    gl.domElement.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      gl.domElement.removeEventListener("pointermove", onPointerMove);
      gl.domElement.removeEventListener("click", onClick);
    };
  }, [camera, enabled, gl.domElement, onInteract]);
  useFrame((_state, delta) => {
    if (!enabled) return;
    const input = {
      forward: (keys.current.has("w") || keys.current.has("arrowup") ? 1 : 0) - (keys.current.has("s") || keys.current.has("arrowdown") ? 1 : 0),
      strafe: (keys.current.has("d") || keys.current.has("arrowright") ? 1 : 0) - (keys.current.has("a") || keys.current.has("arrowleft") ? 1 : 0),
    };
    const stepped = stepPlayer(position.current, velocity.current, input, yaw.current, delta, WORLD_BOUNDS);
    position.current = stepped.position;
    velocity.current = stepped.velocity;
    camera.position.set(...position.current);
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    const nextNearby = getNearbyDestination(position.current);
    if (nextNearby?.id !== nearbyRef.current) {
      nearbyRef.current = nextNearby?.id ?? null;
      onNearbyChange(nextNearby);
    }
  });
  return null;
}

function WorldSceneContents({ state, introActive, nearbyId, onNearbyChange, onInteract }: WorldSceneProps) {
  const destinations = useMemo(() => WORLD_DESTINATIONS, []);
  return (
    <>
      <color attach="background" args={["#04120e"]} />
      <fog attach="fog" args={["#04120e", 26, 78]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[-12, 24, 9]} intensity={2.2} color="#d9fff0" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 9, 0]} intensity={1.8} distance={35} color="#8be7c2" />
      <Terrain />
      <OperationsRoads />
      <Trees />
      <Sparkles count={70} scale={[48, 9, 48]} size={1.2} speed={0.14} opacity={0.22} color="#9de7c4" />
      {destinations.map((destination) => <InteractionZone key={destination.id} destination={destination} nearby={nearbyId === destination.id} onInteract={onInteract} />)}
      <PlayerController enabled={!introActive} nearbyId={nearbyId} onNearbyChange={onNearbyChange} onInteract={onInteract} />
      <Html fullscreen>
        <div className="pointer-events-none" data-world-state={`${state.projectCount}-${state.activeIncidentCount}`} />
      </Html>
    </>
  );
}

export function CarbonWorldScene(props: WorldSceneProps) {
  return (
    <Canvas camera={{ position: [0, 2.2, 13], fov: 62 }} dpr={[1, 1.35]} gl={{ antialias: true, powerPreference: "high-performance" }} shadows>
      <WorldSceneContents {...props} />
    </Canvas>
  );
}
