"use client";

import { Html, Line } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useMemo, useRef } from "react";
import type { PerspectiveCamera } from "three";
import { Color, Vector3 } from "three";

import {
  calculateSceneBounds,
  clampScenePosition,
  projectBoundaryToScene,
  projectPointToScene,
  type SceneBounds,
  type SceneRing,
} from "../../lib/utils/geo-to-scene";
import type { InvestigationHotspot, InvestigationSceneState } from "./scene-state";

type SceneProps = {
  data: InvestigationSceneState;
  mode: "cinematic" | "explore";
  onSequenceComplete: () => void;
  onSelectHotspot: (hotspot: InvestigationHotspot) => void;
};

function Terrain({ bounds }: { bounds: SceneBounds }) {
  const width = Math.max(30, bounds.maxX - bounds.minX);
  const depth = Math.max(30, bounds.maxZ - bounds.minZ);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(bounds.minX + bounds.maxX) / 2, -0.15, (bounds.minZ + bounds.maxZ) / 2]} receiveShadow>
      <planeGeometry args={[width, depth, 12, 12]} />
      <meshStandardMaterial color="#0b2a20" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

function BoundaryLines({ rings }: { rings: SceneRing[] }) {
  return <>{rings.map((ring, index) => <Line key={index} points={ring.map(([x, z]) => [x, 0.12, z] as [number, number, number])} color="#6ee7b7" lineWidth={1.5} />)}</>;
}

function Hotspot({
  hotspot,
  position,
  onSelect,
}: {
  hotspot: InvestigationHotspot;
  position: [number, number, number];
  onSelect: (hotspot: InvestigationHotspot) => void;
}) {
  const color = hotspot.kind === "RISK" ? "#fb7185" : hotspot.kind === "EVIDENCE" ? "#60a5fa" : "#fbbf24";
  return (
    <group position={position}>
      <mesh onClick={(event) => { event.stopPropagation(); onSelect(hotspot); }}>
        <sphereGeometry args={[0.42, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} />
      </mesh>
      <Html distanceFactor={12} position={[0.55, 0.45, 0]}>
        <button type="button" onClick={() => onSelect(hotspot)} className="whitespace-nowrap rounded-full border border-white/15 bg-[#07110f]/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200 shadow-lg">
          {hotspot.kind === "RISK" ? "Risk" : hotspot.kind === "EVIDENCE" ? "Evidence" : "Observation"}
        </button>
      </Html>
    </group>
  );
}

function AnomalyZone({ position, visible }: { position: [number, number, number] | null; visible: boolean }) {
  if (!visible || !position) return null;
  return <mesh rotation-x={-Math.PI / 2} position={[position[0], 0.16, position[2]]}>
    <ringGeometry args={[1.2, 2.1, 48]} />
    <meshBasicMaterial color="#fb7185" transparent opacity={0.32} />
  </mesh>;
}

function GuidedCamera({ bounds, mode, onComplete }: { bounds: SceneBounds; mode: SceneProps["mode"]; onComplete: () => void }) {
  const { camera } = useThree();
  const timeline = useRef<gsap.core.Timeline | null>(null);
  useEffect(() => {
    timeline.current?.kill();
    const perspectiveCamera = camera as PerspectiveCamera;
    const center = new Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
    if (mode === "explore") {
      perspectiveCamera.position.set(center.x, Math.min(13, Math.max(7, (bounds.maxX - bounds.minX) * 0.7)), center.z + 12);
      perspectiveCamera.lookAt(center);
      return;
    }
    const lookAt = { x: center.x, y: 0, z: center.z };
    perspectiveCamera.position.set(bounds.maxX + 12, 18, bounds.maxZ + 14);
    timeline.current = gsap.timeline({ onComplete });
    timeline.current.to(perspectiveCamera.position, { x: center.x + 7, y: 8, z: center.z + 9, duration: 3.6, ease: "power2.inOut" });
    timeline.current.to(lookAt, { x: center.x, y: 0, z: center.z, duration: 3.6, ease: "power2.inOut", onUpdate: () => perspectiveCamera.lookAt(lookAt.x, lookAt.y, lookAt.z) }, "<");
    return () => {
      timeline.current?.kill();
    };
  }, [bounds, camera, mode, onComplete]);
  return null;
}

function ExplorerControls({ bounds, enabled }: { bounds: SceneBounds; enabled: boolean }) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(-0.25);
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => keys.current.add(event.key.toLowerCase());
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const onPointerMove = (event: PointerEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      yaw.current -= event.movementX * 0.0025;
      pitch.current = Math.max(-1.15, Math.min(0.55, pitch.current - event.movementY * 0.0025));
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
  }, [camera, enabled, gl.domElement]);
  useFrame((_state, delta) => {
    if (!enabled) return;
    const speed = 8 * Math.min(delta, 0.05);
    const forward = (keys.current.has("w") ? 1 : 0) - (keys.current.has("s") ? 1 : 0);
    const strafe = (keys.current.has("d") ? 1 : 0) - (keys.current.has("a") ? 1 : 0);
    const length = Math.hypot(forward, strafe) || 1;
    const next: [number, number, number] = [
      camera.position.x + ((Math.sin(yaw.current) * forward + Math.cos(yaw.current) * strafe) / length) * speed,
      camera.position.y,
      camera.position.z + ((-Math.cos(yaw.current) * forward + Math.sin(yaw.current) * strafe) / length) * speed,
    ];
    camera.position.set(...clampScenePosition(next, bounds));
  });
  return null;
}

function SceneContents({ data, mode, onSequenceComplete, onSelectHotspot }: SceneProps) {
  const rings = useMemo(() => data.project.boundary ? projectBoundaryToScene(data.project.boundary.geojson, data.project.centroid) : [], [data.project.boundary, data.project.centroid]);
  const bounds = useMemo(() => calculateSceneBounds(rings), [rings]);
  const eventPoint = useMemo(() => projectPointToScene(data.event.coordinate, data.project.centroid), [data.event.coordinate, data.project.centroid]);
  const hotspotPositions = useMemo(
    () =>
      data.hotspots
        .map((hotspot) => ({
          hotspot,
          point: projectPointToScene(hotspot.coordinate, data.project.centroid),
        }))
        .filter(
          (item): item is { hotspot: InvestigationHotspot; point: [number, number] } =>
            Boolean(item.point),
        ),
    [data.hotspots, data.project.centroid],
  );
  return (
    <>
      <color attach="background" args={["#04100c"]} />
      <fog attach="fog" args={["#04100c", 22, 80]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[12, 20, 7]} intensity={2.4} color="#d9fff0" castShadow />
      <Terrain bounds={bounds} />
      <BoundaryLines rings={rings} />
      <AnomalyZone position={eventPoint ? [eventPoint[0], 0, eventPoint[1]] : null} visible={data.anomalyVisible} />
      {hotspotPositions.map(({ hotspot, point }) => <Hotspot key={hotspot.id} hotspot={hotspot} position={[point[0], hotspot.kind === "RISK" ? 0.45 : 0.3, point[1]]} onSelect={onSelectHotspot} />)}
      <GuidedCamera bounds={bounds} mode={mode} onComplete={onSequenceComplete} />
      <ExplorerControls bounds={bounds} enabled={mode === "explore"} />
    </>
  );
}

export function Investigation3DScene(props: SceneProps) {
  return <Canvas shadows camera={{ position: [20, 18, 24], fov: 48 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
    <SceneContents {...props} />
  </Canvas>;
}
