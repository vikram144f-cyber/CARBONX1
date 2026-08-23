"use client";

import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { Vector3 } from "three";

import { Game } from "../bruno-world/Game.js";
import { RayCursor } from "../bruno-world/RayCursor.js";
import { Zones } from "../bruno-world/Zones.js";
import { CARBONX_THEME } from "../../lib/theme";
import {
  type WorldDestination,
  type WorldDestinationId,
  type WorldState,
  WORLD_DESTINATIONS,
} from "./navigation-state";
import { BrunoEnvironment, BrunoVehicle } from "./bruno-environment";
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

type ZoneLike = {
  id: WorldDestinationId;
  events: {
    on: (name: string, callback: (zone: unknown) => void) => unknown;
    off: (name: string, callback: (zone: unknown) => void) => unknown;
  };
};

type BrunoRuntimeValue = {
  game: Game;
  rayCursor: RayCursor;
  zoneById: Map<WorldDestinationId, ZoneLike>;
};

const BrunoRuntimeContext = createContext<BrunoRuntimeValue | null>(null);

function useBrunoRuntime() {
  const runtime = useContext(BrunoRuntimeContext);
  if (!runtime) throw new Error("Bruno runtime is unavailable outside the world canvas.");
  return runtime;
}

function BrunoRuntime({ children }: { children: ReactNode }) {
  const { camera, gl, scene, size } = useThree();
  const runtime = useMemo(() => {
    const game = Game.configure({ scene, camera, domElement: gl.domElement, width: size.width, height: size.height });
    const zones = new Zones(game);
    const zoneById = new Map<WorldDestinationId, ZoneLike>();
    for (const destination of WORLD_DESTINATIONS) {
      const zone = zones.create("cylinder", new Vector3(...destination.position), destination.radius) as unknown as ZoneLike;
      zone.id = destination.id;
      zoneById.set(destination.id, zone);
    }
    return { game, rayCursor: new RayCursor(), zoneById };
  }, [camera, gl.domElement, scene, size.height, size.width]);

  useEffect(() => {
    const element = gl.domElement;
    const updatePointer = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect();
      const nextX = event.clientX - bounds.left;
      const nextY = event.clientY - bounds.top;
      runtime.game.inputs.pointer.delta.x = nextX - runtime.game.inputs.pointer.current.x;
      runtime.game.inputs.pointer.delta.y = nextY - runtime.game.inputs.pointer.current.y;
      runtime.game.inputs.pointer.current.x = nextX;
      runtime.game.inputs.pointer.current.y = nextY;
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

function AmbientParticles() {
  const particlesRef = useRef<THREE.Points | null>(null);
  const geometry = useMemo(() => {
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = ((index * 37) % 92) - 46;
      positions[index * 3 + 1] = 1.2 + ((index * 17) % 70) / 10;
      positions[index * 3 + 2] = ((index * 61) % 92) - 46;
    }
    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return nextGeometry;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    particlesRef.current.rotation.y = clock.elapsedTime * 0.008;
    particlesRef.current.position.y = Math.sin(clock.elapsedTime * 0.16) * 0.12;
  });

  return (
    <points ref={particlesRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#ffd8b0" size={0.09} transparent opacity={0.2} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function DestinationParticles({ color, active }: { color: string; active: boolean }) {
  const particlesRef = useRef<THREE.Points | null>(null);
  const geometry = useMemo(() => {
    const count = 18;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const radius = 0.7 + (index % 4) * 0.16;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 0.55 + (index % 6) * 0.34;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return nextGeometry;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    particlesRef.current.rotation.y = clock.elapsedTime * (active ? 0.45 : 0.12);
    particlesRef.current.position.y = Math.sin(clock.elapsedTime * 1.5) * 0.08;
  });

  return (
    <points ref={particlesRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial color={color} size={active ? 0.14 : 0.055} transparent opacity={active ? 0.75 : 0.2} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function BrunoLighting() {
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const targetRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    if (lightRef.current && targetRef.current) lightRef.current.target = targetRef.current;
  }, []);

  useFrame(({ clock }) => {
    if (!lightRef.current || !targetRef.current) return;
    const time = clock.elapsedTime * 0.018;
    lightRef.current.position.set(-24 + Math.cos(time) * 10, 28 + Math.sin(time * 0.7) * 4, 16 + Math.sin(time) * 10);
    targetRef.current.position.set(0, 0, 0);
  });

  return (
    <>
      <hemisphereLight args={["#f3d6c3", "#24171d", 1.25]} />
      <ambientLight intensity={0.32} />
      <directionalLight
        ref={lightRef}
        position={[-24, 28, 16]}
        intensity={4.6}
        color="#ffe1c3"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.08}
        shadow-radius={3}
        shadow-camera-near={1}
        shadow-camera-far={110}
        shadow-camera-left={-42}
        shadow-camera-right={42}
        shadow-camera-top={42}
        shadow-camera-bottom={-42}
      />
      <object3D ref={targetRef} />
      <pointLight position={[-8, 5, 8]} intensity={1.4} distance={26} decay={2} color="#ff9b68" />
      <pointLight position={[10, 3, -12]} intensity={0.9} distance={20} decay={2} color="#738cff" />
    </>
  );
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
  const beaconRef = useRef<THREE.Group | null>(null);
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
    beaconRef.current.rotation.y = clock.elapsedTime * (nearby ? 0.75 : 0.16);
    const pulse = 1 + Math.sin(clock.elapsedTime * (nearby ? 2.2 : 1.1) + destination.position[0]) * (nearby ? 0.08 : 0.035);
    beaconRef.current.scale.setScalar(pulse);
  });

  return (
    <group position={destination.position}>
      <mesh ref={meshRef} position={[0, 1.4, 0]}>
        <cylinderGeometry args={[2.5, 2.5, 3.1, 20, 1, true]} />
        <meshBasicMaterial color={destination.accent} transparent opacity={nearby ? 0.025 : 0.008} wireframe />
      </mesh>
      <group ref={beaconRef} position={[0, 0.12, 0]}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.45, nearby ? 0.09 : 0.04, 8, 48]} />
          <meshBasicMaterial color={destination.accent} transparent opacity={nearby ? 0.95 : 0.42} />
        </mesh>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.62, 0.82, 0.28, 8]} />
          <meshStandardMaterial color={destination.accent} emissive={destination.accent} emissiveIntensity={nearby ? 0.75 : 0.2} roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.42, 0]}>
          <cylinderGeometry args={[0.022, 0.055, 2.45, 8]} />
          <meshBasicMaterial color={destination.accent} transparent opacity={nearby ? 0.88 : 0.42} />
        </mesh>
        <mesh position={[0, 2.72, 0]}>
          <icosahedronGeometry args={[nearby ? 0.24 : 0.16, 1]} />
          <meshStandardMaterial color={destination.accent} emissive={destination.accent} emissiveIntensity={nearby ? 2.2 : 0.55} roughness={0.3} />
        </mesh>
      </group>
      <pointLight color={destination.accent} intensity={nearby ? 1.5 : 0.18} distance={nearby ? 7 : 3} decay={2} position={[0, 1.9, 0]} />
      <DestinationParticles color={destination.accent} active={nearby} />
      <Html position={[0, 3.35, 0]} center distanceFactor={34}>
        <div className="pointer-events-none whitespace-nowrap text-center text-white drop-shadow-lg" style={{ opacity: nearby ? 1 : 0.52 }}>
          <div className="text-[7px] font-semibold uppercase tracking-[0.2em]" style={{ color: destination.accent }}>{destination.eyebrow}</div>
          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]">{destination.label}</div>
          {nearby ? (
            <div className="mt-1 text-[7px] font-semibold uppercase tracking-[0.16em]" style={{ color: destination.accent }}>Press E or click</div>
          ) : null}
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
  const { game, zoneById } = useBrunoRuntime();
  const inputRef = useRef<FolioActionInput | null>(null);
  const roverRef = useRef<THREE.Group | null>(null);
  const rover = useRef<RoverState>({ position: [0, 0.92, 5], heading: 0, speed: 0, steering: 0 });
  const focusPoint = useRef(new Vector3(0, 1.7, 5));
  const cameraPosition = useRef(new Vector3(-9.5, 6.6, 5));
  const orbitYaw = useRef(0);
  const orbitPitch = useRef(0.46);
  const cameraHeading = useRef(0);
  const dragPointer = useRef<{ x: number; y: number } | null>(null);
  const nearbyRef = useRef<WorldDestinationId | null>(nearbyId);
  const lookAhead = useRef(new Vector3());

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
      orbitYaw.current -= (event.clientX - previous.x) * 0.007;
      orbitPitch.current = Math.max(0.5, Math.min(1.15, orbitPitch.current + (event.clientY - previous.y) * 0.005));
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
      roverRef.current.userData.steering = current.steering;
    }
    game.player.position.x = current.position[0];
    game.player.position.y = current.position[1];
    game.player.position.z = current.position[2];
    game.player.position2.x = current.position[0];
    game.player.position2.y = current.position[2];
    game.view.focusPoint.position.x = current.position[0];
    game.view.focusPoint.position.y = current.position[1] + 1.1;
    game.view.focusPoint.position.z = current.position[2];
    const forwardX = Math.cos(current.heading);
    const forwardZ = -Math.sin(current.heading);
    lookAhead.current.set(
      current.position[0] + forwardX * Math.min(0.85, Math.abs(current.speed) * 0.08),
      current.position[1] + 0.78,
      current.position[2] + forwardZ * Math.min(0.85, Math.abs(current.speed) * 0.08),
    );
    focusPoint.current.lerp(lookAhead.current, 1 - Math.exp(-8 * Math.min(delta, 0.05)));
    if (!dragPointer.current) orbitYaw.current *= Math.exp(-1.2 * Math.min(delta, 0.05));
    const targetCameraHeading = current.heading + orbitYaw.current;
    const headingDelta = Math.atan2(Math.sin(targetCameraHeading - cameraHeading.current), Math.cos(targetCameraHeading - cameraHeading.current));
    cameraHeading.current += headingDelta * (1 - Math.exp(-7 * Math.min(delta, 0.05)));
    const speedRatio = Math.min(1, Math.abs(current.speed) / 13);
    const distance = 10.6 + speedRatio * 3.2;
    const horizontal = Math.cos(orbitPitch.current) * distance;
    const targetCameraPosition = new Vector3(
      focusPoint.current.x - Math.cos(cameraHeading.current) * horizontal,
      focusPoint.current.y + Math.sin(orbitPitch.current) * distance + 0.25,
      focusPoint.current.z + Math.sin(cameraHeading.current) * horizontal,
    );
    cameraPosition.current.lerp(targetCameraPosition, 1 - Math.exp(-6.5 * Math.min(delta, 0.05)));
    camera.position.copy(cameraPosition.current);
    camera.lookAt(focusPoint.current);
    game.tick(delta);
  });

  return <BrunoVehicle vehicleRef={roverRef} />;
}

function WorldSceneContents(props: WorldSceneProps) {
  const destinations = useMemo(() => WORLD_DESTINATIONS, []);
  return (
    <BrunoRuntime>
      <color attach="background" args={[CARBONX_THEME.worldFog]} />
      <fog attach="fog" args={[CARBONX_THEME.worldFog, 32, 108]} />
      <BrunoLighting />
      <BrunoEnvironment />
      <AmbientParticles />
      {destinations.map((destination) => (
        <InteractionZone
          key={destination.id}
          destination={destination}
          nearby={props.nearbyId === destination.id}
          onInteract={props.onInteract}
        />
      ))}
      <PlayerController
        enabled={!props.introActive}
        nearbyId={props.nearbyId}
        onNearbyChange={props.onNearbyChange}
        onInteract={props.onInteract}
      />
    </BrunoRuntime>
  );
}

export function CarbonWorldScene(props: WorldSceneProps) {
  return (
    <div className="absolute inset-0" style={{ height: "100%", inset: 0, position: "absolute", width: "100%" }}>
      <Canvas
        style={{ display: "block", height: "100%", width: "100%" }}
        camera={{ position: [-9.5, 6.6, 5], fov: 52 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
        shadows
      >
        <WorldSceneContents {...props} />
      </Canvas>
    </div>
  );
}
