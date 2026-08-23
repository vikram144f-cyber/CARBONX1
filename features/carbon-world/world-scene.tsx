"use client";

import { Html, Line, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { ColorRepresentation, Group } from "three";
import { Color } from "three";

import {
  type WorldDestination,
  type WorldDestinationId,
  type WorldState,
  WORLD_DESTINATIONS,
} from "./navigation-state";
import { BrunoKeyboardInput, BrunoZoneManager } from "./bruno-simon-adapter";
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
        <meshStandardMaterial color="#123329" roughness={0.92} metalness={0.04} />
      </mesh>
      <gridHelper args={[52, 26, "#3f8a70", "#1b4939"]} position={[0, -0.27, 0]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.2, 0]}>
        <ringGeometry args={[23.8, 24.2, 64]} />
        <meshBasicMaterial color="#54c69a" transparent opacity={0.55} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.24, 0]}>
        <circleGeometry args={[8.5, 64]} />
        <meshStandardMaterial color="#163d31" emissive="#0d2c22" emissiveIntensity={0.35} roughness={0.8} />
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
        <meshStandardMaterial color="#1b4b3d" roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.15, 0]}>
        <planeGeometry args={[50, 2.2]} />
        <meshStandardMaterial color="#1b4b3d" roughness={0.9} />
      </mesh>
      <Line points={[[-25, -0.05, 0], [25, -0.05, 0]]} color="#70e0b4" lineWidth={1} transparent opacity={0.55} />
      <Line points={[[0, -0.04, -25], [0, -0.04, 25]]} color="#70e0b4" lineWidth={1} transparent opacity={0.55} />
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
        <meshStandardMaterial color="#183f34" metalness={0.25} roughness={0.58} />
      </mesh>
      <mesh position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.08, 0.3, 4.2, 10]} />
        <meshStandardMaterial color="#7ff0c2" emissive="#6ee7b7" emissiveIntensity={1.5} transparent opacity={0.75} />
      </mesh>
      <group ref={rotatingRef} position={[0, 1.05, 0]}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[3.6, 0.07, 8, 64]} />
          <meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={1.2} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} rotation-z={Math.PI / 3}>
          <torusGeometry args={[2.9, 0.035, 8, 64]} />
          <meshBasicMaterial color="#a7f3d0" transparent opacity={0.65} />
        </mesh>
      </group>
      <pointLight position={[0, 3.5, 0]} intensity={2.8} distance={18} color="#6ee7b7" />
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
  const beaconRef = useRef<Group | null>(null);
  useFrame(({ clock }) => {
    if (!beaconRef.current) return;
    beaconRef.current.rotation.y = clock.elapsedTime * (nearby ? 0.75 : 0.28);
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.7 + destination.position[0]) * 0.045;
    beaconRef.current.scale.setScalar(pulse);
  });
  return (
    <group position={destination.position}>
      <mesh onClick={(event) => { event.stopPropagation(); if (nearby) onInteract(destination.id); }} position={[0, 1.7, 0]}>
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
      <Html position={[0, 5.2, 0]} center distanceFactor={14}>
        <div className={`pointer-events-none whitespace-nowrap rounded-xl border px-3 py-2 shadow-xl backdrop-blur-md transition ${nearby ? "scale-110 border-white/25 bg-[#07110f]/95 text-white" : "border-white/10 bg-[#07110f]/75 text-slate-300"}`}>
          <div className="text-[8px] font-semibold uppercase tracking-[0.2em]" style={{ color: destination.accent }}>{destination.eyebrow}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
            {destination.label}
          </div>
        </div>
      </Html>
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
  const keyboardRef = useRef<BrunoKeyboardInput | null>(null);
  const zonesRef = useRef<BrunoZoneManager | null>(null);
  const position = useRef<PlayerPosition>([0, 2.7, 13]);
  const velocity = useRef({ forward: 0, strafe: 0 });
  const yaw = useRef(0);
  const pitch = useRef(-0.16);
  const nearbyRef = useRef<WorldDestinationId | null>(nearbyId);
  if (!zonesRef.current) {
    const manager = new BrunoZoneManager();
    for (const destination of WORLD_DESTINATIONS) {
      manager.create("cylinder", destination.id, destination.position, destination.radius);
    }
    zonesRef.current = manager;
  }
  useEffect(() => { nearbyRef.current = nearbyId; }, [nearbyId]);
  useEffect(() => {
    if (!enabled) {
      keyboardRef.current?.dispose();
      keyboardRef.current = null;
      keys.current.clear();
      velocity.current = { forward: 0, strafe: 0 };
      return;
    }
    const keyboard = new BrunoKeyboardInput();
    keyboardRef.current = keyboard;
    const removeDown = keyboard.onDown((code, key) => {
      const normalized = key.toLowerCase();
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) {
        keys.current.add(code);
      }
      if ((code === "KeyE" || code === "Enter" || normalized === "e" || normalized === "enter") && nearbyRef.current) {
        onInteract(nearbyRef.current);
      }
    });
    const removeUp = keyboard.onUp((code) => keys.current.delete(code));
    const onPointerMove = (event: PointerEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      yaw.current -= event.movementX * 0.0022;
      pitch.current = Math.max(-1.1, Math.min(0.55, pitch.current - event.movementY * 0.0022));
      camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    };
    const onClick = () => { void gl.domElement.requestPointerLock?.(); };
    gl.domElement.addEventListener("pointermove", onPointerMove);
    gl.domElement.addEventListener("click", onClick);
    return () => {
      removeDown();
      removeUp();
      keyboard.dispose();
      keyboardRef.current = null;
      gl.domElement.removeEventListener("pointermove", onPointerMove);
      gl.domElement.removeEventListener("click", onClick);
    };
  }, [camera, enabled, gl.domElement, onInteract]);
  useFrame((_state, delta) => {
    if (!enabled) return;
    const keyboard = keyboardRef.current;
    const input = {
      forward: (keyboard?.isPressed("KeyW", "ArrowUp") || keys.current.has("KeyW") || keys.current.has("ArrowUp") ? 1 : 0) - (keyboard?.isPressed("KeyS", "ArrowDown") || keys.current.has("KeyS") || keys.current.has("ArrowDown") ? 1 : 0),
      strafe: (keyboard?.isPressed("KeyD", "ArrowRight") || keys.current.has("KeyD") || keys.current.has("ArrowRight") ? 1 : 0) - (keyboard?.isPressed("KeyA", "ArrowLeft") || keys.current.has("KeyA") || keys.current.has("ArrowLeft") ? 1 : 0),
    };
    const stepped = stepPlayer(position.current, velocity.current, input, yaw.current, delta, WORLD_BOUNDS);
    position.current = stepped.position;
    velocity.current = stepped.velocity;
    camera.position.set(...position.current);
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    zonesRef.current?.update(
      stepped.position,
      (zone) => {
        const destination = WORLD_DESTINATIONS.find((item) => item.id === zone.id) ?? null;
        nearbyRef.current = destination?.id ?? null;
        onNearbyChange(destination);
      },
      (zone) => {
        if (nearbyRef.current === zone.id) {
          nearbyRef.current = null;
          onNearbyChange(null);
        }
      },
    );
  });
  return null;
}

function WorldSceneContents({ state, introActive, nearbyId, onNearbyChange, onInteract }: WorldSceneProps) {
  const destinations = useMemo(() => WORLD_DESTINATIONS, []);
  return (
    <>
      <color attach="background" args={["#071c16"]} />
      <fog attach="fog" args={["#071c16", 30, 82]} />
      <hemisphereLight args={["#c9fff0", "#06130f", 1.45]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-12, 24, 9]} intensity={2.7} color="#e5fff6" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 9, 0]} intensity={2.2} distance={38} color="#8be7c2" />
      <Terrain />
      <OperationsRoads />
      <NavigationHub />
      <Trees />
      <Sparkles count={95} scale={[48, 10, 48]} size={1.35} speed={0.12} opacity={0.3} color="#b7f7dc" />
      {destinations.map((destination) => <InteractionZone key={destination.id} destination={destination} nearby={nearbyId === destination.id} onInteract={onInteract} />)}
      <PlayerController enabled={!introActive} nearbyId={nearbyId} onNearbyChange={onNearbyChange} onInteract={onInteract} />
    </>
  );
}

export function CarbonWorldScene(props: WorldSceneProps) {
  return (
    <Canvas className="!absolute inset-0 h-full w-full" camera={{ position: [0, 2.7, 13], fov: 60 }} dpr={[1, 1.4]} gl={{ antialias: true, powerPreference: "high-performance" }} shadows>
      <WorldSceneContents {...props} />
    </Canvas>
  );
}
