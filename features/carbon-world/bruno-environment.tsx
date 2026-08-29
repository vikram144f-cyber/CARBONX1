"use client";

import { Clone, useGLTF, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { Group, InstancedMesh } from "three";
import { CARBONX_THEME } from "../../lib/theme";

useGLTF.setDecoderPath("/bruno/draco/");

const TREE_TYPES = [
  ["/bruno/birchTrees/birchTreesVisual.glb", "/bruno/birchTrees/birchTreesReferences.glb"],
  ["/bruno/oakTrees/oakTreesVisual.glb", "/bruno/oakTrees/oakTreesReferences.glb"],
  ["/bruno/cherryTrees/cherryTreesVisual.glb", "/bruno/cherryTrees/cherryTreesReferences.glb"],
] as const;

type RendererCapabilities = {
  getMaxAnisotropy?: () => number;
};

function getAnisotropy(renderer: unknown) {
  const capabilities = (renderer as { capabilities?: RendererCapabilities } | null)?.capabilities;
  return Math.min(8, Math.max(1, capabilities?.getMaxAnisotropy?.() ?? 1));
}

function prepareTexture(
  texture: THREE.Texture,
  renderer: unknown,
  options: { color?: boolean; data?: boolean; repeat?: boolean } = {},
) {
  if (options.data) texture.colorSpace = THREE.NoColorSpace;
  if (options.color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = options.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = options.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = getAnisotropy(renderer);
  texture.needsUpdate = true;
}

function prepareScene(scene: THREE.Object3D, renderer: unknown) {
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      const materialRecord = material as THREE.Material & Record<string, unknown>;
      for (const key of ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap"]) {
        const texture = materialRecord[key];
        if (texture instanceof THREE.Texture) {
          prepareTexture(texture, renderer);
        }
      }
    }
  });
}

function alignVisualToGround(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  if (Number.isFinite(bounds.min.y)) scene.position.y -= bounds.min.y;
}

function createFoliageMaterial(color: THREE.ColorRepresentation, foliageTexture: THREE.Texture) {
  const material = new THREE.MeshStandardMaterial({
    color,
    alphaMap: foliageTexture,
    alphaTest: 0.01,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 1,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphamap_fragment>",
      `
        #ifdef USE_ALPHAMAP
          float foliageSdf = texture2D(alphaMap, vAlphaMapUv).r;
          float foliageSdfWidth = max(fwidth(foliageSdf), 0.002);
          diffuseColor.a *= smoothstep(0.3 - foliageSdfWidth, 0.3 + foliageSdfWidth, foliageSdf);
        #endif
      `,
    );
  };
  return material;
}

function BrunoTerrain() {
  const { gl } = useThree();
  const { scene } = useGLTF("/bruno/terrain/terrain.glb");
  const terrainTexture = useTexture("/bruno/terrain/terrain.png");
  const terrain = scene.getObjectByName("terrain") as THREE.Mesh | undefined;

  useMemo(() => {
    prepareScene(scene, gl);
    terrainTexture.flipY = false;
    prepareTexture(terrainTexture, gl, { data: true });
  }, [gl, scene, terrainTexture]);

  if (!terrain) return null;
  return (
    <mesh geometry={terrain.geometry} receiveShadow>
      <meshStandardMaterial
        color="#8d776d"
        map={terrainTexture}
        roughness={1}
        metalness={0}
        onBeforeCompile={(shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `
              vec4 terrainData = texture2D(map, vMapUv);
              float elevation = 1.0 - terrainData.b;
              vec3 terrainColor = mix(vec3(0.075, 0.216, 0.373), vec3(0.357, 0.761, 0.725), smoothstep(0.2, 0.55, elevation));
              terrainColor = mix(terrainColor, vec3(1.0, 0.663, 0.306), smoothstep(0.62, 0.9, elevation));
              terrainColor = mix(terrainColor, vec3(0.72, 0.71, 0.18), terrainData.g);
              diffuseColor *= vec4(terrainColor, 1.0);
            `,
          );
        }}
      />
    </mesh>
  );
}

function BrunoFloor() {
  const { gl } = useThree();
  const slabsTexture = useTexture("/bruno/floor/slabs.png");
  useMemo(() => {
    slabsTexture.repeat.set(36, 36);
    prepareTexture(slabsTexture, gl, { color: true, repeat: true });
  }, [gl, slabsTexture]);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -1.56, 0]} receiveShadow>
      <planeGeometry args={[192, 192]} />
      <meshStandardMaterial
        color="#8d7775"
        map={slabsTexture}
        roughness={0.92}
        metalness={0.02}
      />
    </mesh>
  );
}

function BrunoScenery() {
  const { gl } = useThree();
  const { scene } = useGLTF("/bruno/scenery/scenery.glb");
  useMemo(() => prepareScene(scene, gl), [gl, scene]);
  return <Clone object={scene} />;
}

function BrunoPoleLights() {
  const { gl } = useThree();
  const { scene } = useGLTF("/bruno/poleLights/poleLights.glb");
  const lights = useMemo(() => {
    prepareScene(scene, gl);
    return scene.children
      .filter((child) => child.name.toLowerCase().startsWith("polelight"))
      .map((child) => ({
        position: [child.position.x, child.position.y + 1.05, child.position.z] as [number, number, number],
        rotation: child.rotation.toArray() as [number, number, number],
      }));
  }, [gl, scene]);

  return (
    <group>
      <Clone object={scene} />
      {lights.map((light, index) => (
        <pointLight
          key={index}
          position={light.position}
          rotation={light.rotation}
          color="#ff7d32"
          intensity={1.7}
          distance={6}
          decay={2}
        />
      ))}
    </group>
  );
}

function BrunoLanterns() {
  const { gl } = useThree();
  const { scene } = useGLTF("/bruno/lanterns/lanterns.glb");
  useMemo(() => prepareScene(scene, gl), [gl, scene]);
  return <Clone object={scene} />;
}

type ReferenceTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

type VisualWheel = {
  container: THREE.Object3D;
  cylinder: THREE.Object3D | null;
  baseRotation: number;
  front: boolean;
  side: number;
};

function getTreeReferences(scene: THREE.Object3D) {
  return scene.children
    .filter((child) => child.name.toLowerCase().startsWith("treebody"))
    .map((child): ReferenceTransform => ({
      position: child.position.toArray() as [number, number, number],
      rotation: child.rotation.toArray() as [number, number, number],
      scale: child.scale.toArray() as [number, number, number],
    }));
}

function BrunoTreeType({ visualPath, referencesPath }: { visualPath: string; referencesPath: string }) {
  const { gl } = useThree();
  const visual = useGLTF(visualPath);
  const references = useGLTF(referencesPath);
  const transforms = useMemo(() => {
    prepareScene(visual.scene, gl);
    return getTreeReferences(references.scene);
  }, [gl, references.scene, visual.scene]);

  return (
    <group>
      {transforms.map((transform, index) => (
        <group key={index} position={transform.position} rotation={transform.rotation} scale={transform.scale}>
          <Clone object={visual.scene} />
        </group>
      ))}
    </group>
  );
}

function BrunoTrees() {
  return (
    <group>
      {TREE_TYPES.map(([visualPath, referencesPath]) => (
        <BrunoTreeType key={visualPath} visualPath={visualPath} referencesPath={referencesPath} />
      ))}
    </group>
  );
}

function BrunoFoliageCards({ referencesPath, countScale = 1 }: { referencesPath: string; countScale?: number }) {
  const { gl } = useThree();
  const { scene } = useGLTF(referencesPath);
  const foliageTexture = useTexture("/bruno/foliage/foliageSDF.png");
  useMemo(() => prepareTexture(foliageTexture, gl, { data: true }), [foliageTexture, gl]);
  const references = useMemo(
    () => scene.children.map((child) => ({
      position: child.position.clone(),
      rotation: child.rotation.clone(),
      scale: child.scale.clone().multiplyScalar(countScale),
    })),
    [countScale, scene],
  );
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(() => createFoliageMaterial("#b9aa9a", foliageTexture), [foliageTexture]);
  const first = useRef<InstancedMesh>(null);
  const second = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const helper = new THREE.Object3D();
    for (let index = 0; index < references.length; index += 1) {
      const reference = references[index];
      helper.position.copy(reference.position);
      helper.rotation.copy(reference.rotation);
      helper.scale.copy(reference.scale).multiplyScalar(2.25);
      helper.position.y += helper.scale.y * 0.45;
      helper.updateMatrix();
      first.current?.setMatrixAt(index, helper.matrix);
      helper.rotation.y += Math.PI / 2;
      helper.updateMatrix();
      second.current?.setMatrixAt(index, helper.matrix);
    }
    if (first.current) first.current.instanceMatrix.needsUpdate = true;
    if (second.current) second.current.instanceMatrix.needsUpdate = true;
  }, [references]);

  return (
    <group>
      <instancedMesh ref={first} args={[geometry, material, references.length]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={second} args={[geometry, material, references.length]} frustumCulled={false} dispose={null} />
    </group>
  );
}

function BrunoBushes() {
  return <BrunoFoliageCards referencesPath="/bruno/bushes/bushesReferences.glb" countScale={1.35} />;
}

function BrunoGrass() {
  const { gl } = useThree();
  const foliageTexture = useTexture("/bruno/foliage/foliageSDF.png");
  useMemo(() => prepareTexture(foliageTexture, gl, { data: true }), [foliageTexture, gl]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(() => createFoliageMaterial("#9f9189", foliageTexture), [foliageTexture]);
  const count = 650;
  const first = useRef<InstancedMesh>(null);
  const second = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const helper = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const x = ((index * 47) % 92) - 46;
      const z = ((index * 71) % 92) - 46;
      const scale = 0.7 + ((index * 13) % 10) / 14;
      helper.position.set(x, 0.35, z);
      helper.rotation.set(0, (index % 11) * 0.28, 0);
      helper.scale.set(scale, scale * (1.3 + (index % 4) * 0.18), scale);
      helper.updateMatrix();
      first.current?.setMatrixAt(index, helper.matrix);
      helper.rotation.y += Math.PI / 2;
      helper.updateMatrix();
      second.current?.setMatrixAt(index, helper.matrix);
    }
    if (first.current) first.current.instanceMatrix.needsUpdate = true;
    if (second.current) second.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={first} args={[geometry, material, count]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={second} args={[geometry, material, count]} frustumCulled={false} dispose={null} />
    </group>
  );
}

export function BrunoVehicle({ vehicleRef }: { vehicleRef: MutableRefObject<Group | null> }) {
  const { gl } = useThree();
  const { scene } = useGLTF("/bruno/vehicle/default.glb");
  const wheelsRef = useRef<VisualWheel[]>([]);
  const vehicleVisual = useMemo(() => {
    const visual = scene.clone(true);
    const chassis = visual.children.find((child) => child.name.toLowerCase().startsWith("chassis"));
    const wheelTemplate = visual.children.find((child) => child.name.toLowerCase().startsWith("wheelcontainer"));
    if (!chassis || !wheelTemplate) {
      prepareScene(visual, gl);
      alignVisualToGround(visual);
      return visual;
    }

    // The GLB's authored chassis elevation is for Bruno's physics hierarchy.
    // The CARBONX adapter owns the vehicle root, so keep the wheel/chassis
    // relationship local before aligning the complete visual to the terrain.
    chassis.position.set(0, 0, 0);
    wheelTemplate.visible = false;
    const wheelPositions: Array<[number, number, number]> = [
      [0.9, -0.417, 0.75],
      [0.9, -0.417, -0.75],
      [-0.9, -0.417, 0.75],
      [-0.9, -0.417, -0.75],
    ];
    wheelsRef.current = wheelPositions.map(([x, y, z], index) => {
      const container = wheelTemplate.clone(true);
      const baseRotation = index === 0 || index === 2 ? Math.PI : 0;
      container.visible = true;
      container.position.set(x, y, z);
      container.rotation.y = baseRotation;
      chassis.add(container);
      let cylinder: THREE.Object3D | null = null;
      container.traverse((child) => {
        if (child.name.toLowerCase().startsWith("wheelcylinder")) cylinder = child;
      });
      return { container, cylinder, baseRotation, front: index < 2, side: index % 2 === 0 ? 1 : -1 };
    });
    prepareScene(visual, gl);
    alignVisualToGround(visual);
    return visual;
  }, [gl, scene]);

  useFrame((_, delta) => {
    const speed = Number(vehicleRef.current?.userData.speed ?? 0);
    const steering = Number(vehicleRef.current?.userData.steering ?? 0) * 0.5;
    for (const wheel of wheelsRef.current) {
      wheel.container.rotation.y = wheel.baseRotation + (wheel.front ? steering : 0);
      if (wheel.cylinder) wheel.cylinder.rotation.z += (wheel.side * speed * delta) / 0.4;
    }
  });

  return (
    <group ref={vehicleRef} scale={0.9}>
      <group name="vehicleVisualPivot">
        <primitive object={vehicleVisual} />
      </group>
    </group>
  );
}

export function BrunoEnvironment() {
  return (
    <group>
      <BrunoFloor />
      <BrunoTerrain />
      <BrunoScenery />
      <BrunoPoleLights />
      <BrunoLanterns />
      <BrunoTrees />
      <BrunoBushes />
      <BrunoGrass />
      <pointLight position={[0, 5, 0]} intensity={1.1} distance={26} color={CARBONX_THEME.worldGlow} />
    </group>
  );
}
