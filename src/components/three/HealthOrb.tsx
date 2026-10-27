"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sceneState, windowProgress } from "@/lib/scroll-state";

/**
 * Hero object: a glass shell protecting an anatomical core, wrapped by
 * timeline rings. Every part is procedural geometry — no model downloads.
 *
 * Scroll acts:
 *   0.00-0.22  shell sealed, slow drift
 *   0.22-0.48  shell shatters outward, transparency drops, core appears
 *   0.48-0.78  core swells, rings form
 *   0.78-1.00  rings align flat into a timeline disc
 *
 * Each part reads the shared scene state inside useFrame, so scrolling never
 * triggers a React re-render.
 */

const SHELL_RADIUS = 1.5;
const SHARD_COUNT = 54;
const PARTICLE_COUNT = typeof window !== "undefined" && window.innerWidth < 768 ? 600 : 1400;

const CORE_LOBES: { pos: [number, number, number]; scale: number }[] = [
  { pos: [0, 0.12, 0], scale: 0.62 },
  { pos: [0.42, -0.16, 0.16], scale: 0.4 },
  { pos: [-0.4, -0.1, -0.12], scale: 0.44 },
  { pos: [0.12, 0.5, -0.24], scale: 0.33 },
  { pos: [-0.2, 0.36, 0.3], scale: 0.3 },
  { pos: [0.06, -0.48, 0.2], scale: 0.28 },
];

const RING_SPECS: { radius: number; tilt: [number, number, number]; color: string }[] = [
  { radius: 2.05, tilt: [Math.PI / 2.6, 0, 0.2], color: "#2ee6c5" },
  { radius: 2.5, tilt: [Math.PI / 1.9, 0.4, -0.3], color: "#3aa0ff" },
  { radius: 3, tilt: [Math.PI / 2.3, -0.3, 0.5], color: "#7c5cff" },
];

function GlassShell() {
  const glass = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.LineSegments>(null);

  useFrame((_, dt) => {
    if (sceneState.reduced) return;
    const reveal = windowProgress(sceneState.progress, 0.12, 0.4);
    if (glass.current) {
      const m = glass.current.material as THREE.MeshPhysicalMaterial;
      m.opacity = THREE.MathUtils.lerp(0.42, 0.04, reveal);
      glass.current.rotation.y += dt * 0.08;
    }
    if (wire.current) {
      const mat = wire.current.material as THREE.LineBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(0.1, 0.02, reveal);
      wire.current.rotation.y -= dt * 0.05;
      wire.current.rotation.x += dt * 0.02;
    }
  });

  return (
    <group>
      <mesh ref={glass}>
        <sphereGeometry args={[SHELL_RADIUS, 64, 64]} />
        <meshPhysicalMaterial
          transmission={1}
          thickness={0.25}
          roughness={0.04}
          ior={1.28}
          dispersion={0.3}
          iridescence={0.35}
          iridescenceIOR={1.6}
          clearcoat={1}
          clearcoatRoughness={0.05}
          color="#cfe8ff"
          transparent
          opacity={0.42}
          side={THREE.FrontSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments ref={wire}>
        <icosahedronGeometry args={[SHELL_RADIUS * 1.005, 1]} />
        <lineBasicMaterial color="#7ec8ff" transparent opacity={0.1} />
      </lineSegments>
    </group>
  );
}

function Shards() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.TetrahedronGeometry(0.075, 0), []);
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#d8f2ff",
        transmission: 0.95,
        roughness: 0.03,
        thickness: 0.08,
        ior: 1.4,
        iridescence: 0.6,
        transparent: true,
        opacity: 0.85,
      }),
    [],
  );
  const seeds = useMemo(
    () =>
      Array.from({ length: SHARD_COUNT }, (_, i) => {
        const theta = Math.acos(1 - 2 * ((i + 0.5) / SHARD_COUNT));
        const phi = Math.PI * (1 + Math.sqrt(5)) * i;
        const dir = new THREE.Vector3(
          Math.sin(theta) * Math.cos(phi),
          Math.sin(theta) * Math.sin(phi),
          Math.cos(theta),
        );
        return {
          dir,
          spin: new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
          ),
          scale: 0.6 + Math.random() * 0.9,
        };
      }),
    [],
  );

  const positions = useRef(seeds.map((s) => s.dir.clone().multiplyScalar(SHELL_RADIUS)));
  const rotations = useRef(seeds.map(() => new THREE.Euler()));
  const scales = useRef(seeds.map((s) => s.scale));

  useFrame((_, dt) => {
    if (sceneState.reduced) return;
    const mesh = meshRef.current;
    if (!mesh) return;
    const reveal = windowProgress(sceneState.progress, 0.12, 0.4);
    const target = reveal * 2.8;
    const dummy = new THREE.Object3D();
    seeds.forEach((s, i) => {
      const desired = s.dir.clone().multiplyScalar(SHELL_RADIUS + target * s.scale);
      positions.current[i].lerp(desired, 1 - Math.exp(-4 * dt));
      rotations.current[i].x += s.spin.x * dt * reveal;
      rotations.current[i].y += s.spin.y * dt * reveal;
      rotations.current[i].z += s.spin.z * dt * reveal;
      const vis = Math.max(0, reveal * 1.6 - 0.25);
      dummy.position.copy(positions.current[i]);
      dummy.rotation.copy(rotations.current[i]);
      dummy.scale.setScalar(s.scale * vis);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geo, mat, SHARD_COUNT]} />
  );
}

function Core() {
  const group = useRef<THREE.Group>(null);
  const nucleus = useRef<THREE.Mesh>(null);

  useFrame((state, dt) => {
    if (sceneState.reduced) return;
    if (!group.current) return;
    const swell = windowProgress(sceneState.progress, 0.28, 0.62);
    const t = state.clock.elapsedTime;
    // Heartbeat: two quick beats then a rest, layered on a slow breath.
    const beat =
      Math.pow(Math.max(0, Math.sin(t * 1.6)), 12) * 0.5 +
      Math.pow(Math.max(0, Math.sin(t * 1.6 + 0.35)), 12) * 0.3;
    const breath = 1 + Math.sin(t * 0.7) * 0.03;
    const s = (0.2 + swell * 0.62) * breath * (1 + beat * 0.09);
    group.current.scale.setScalar(s);
    group.current.rotation.y += dt * 0.14;
    if (nucleus.current) {
      const nm = nucleus.current.material as THREE.MeshStandardMaterial;
      nm.emissiveIntensity = 1.8 + beat * 2.2 + swell * 1.1;
    }
  });

  return (
    <group ref={group} scale={0.16}>
      {CORE_LOBES.map((lobe, i) => (
        <mesh key={i} position={lobe.pos} scale={lobe.scale}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshStandardMaterial
            color="#c93a2b"
            roughness={0.55}
            metalness={0.05}
            emissive="#7a1206"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
      <mesh ref={nucleus}>
        <sphereGeometry args={[0.3, 48, 48]} />
        <meshStandardMaterial
          color="#ff9a6b"
          emissive="#ff5a24"
          emissiveIntensity={1.5}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}

function Rings() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((_, dt) => {
    if (sceneState.reduced) return;
      const form = windowProgress(sceneState.progress, 0.3, 0.55);
    const align = windowProgress(sceneState.progress, 0.62, 0.9);
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const spec = RING_SPECS[i];
      const baseX = spec.tilt[0];
      const baseY = spec.tilt[1];
      const baseZ = spec.tilt[2];
      const k = 1 - Math.exp(-3 * dt);
      mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, THREE.MathUtils.lerp(baseX, Math.PI / 2, align), k);
      mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, baseY * (1 - align), k);
      mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, baseZ * (1 - align), k);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = form;
      mat.emissiveIntensity = 0.7 + form * 0.9;
      mesh.rotation.z += dt * (0.12 + i * 0.05) * (1 - align);
    });
  });

  return (
    <group>
      {RING_SPECS.map((spec, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          rotation={spec.tilt}
        >
          <torusGeometry args={[spec.radius, 0.022, 16, 220]} />
          <meshStandardMaterial
            color={spec.color}
            emissive={spec.color}
            emissiveIntensity={0.9}
            transparent
            opacity={0}
            metalness={0.35}
            roughness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

function Particles() {
  const points = useRef<THREE.Points>(null);
  const { positions, seedArray } = useMemo(() => {
    const count = PARTICLE_COUNT;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 2.4 + Math.random() * 4.2;
      const theta = Math.acos(1 - 2 * Math.random());
      const phi = Math.PI * 2 * Math.random();
      pos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      pos[i * 3 + 2] = r * Math.cos(theta);
      seed[i] = Math.random();
    }
    return { positions: pos, seedArray: seed };
  }, []);

  useFrame((state) => {
    if (sceneState.reduced) return;
    if (!points.current) return;
    const attr = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < arr.length / 3; i++) {
      const s = seedArray[i];
      arr[i * 3 + 1] += Math.sin(t * 0.4 + s * 12) * 0.0009;
      arr[i * 3 + 2] += Math.cos(t * 0.33 + s * 9) * 0.0009;
    }
    attr.needsUpdate = true;
    points.current.rotation.y += 0.02 * 0.016;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#cdeeff"
        transparent
        opacity={0.65}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function HealthOrb() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    if (sceneState.reduced) return;
    if (!group.current) return;
    const targetY = sceneState.pointer.x * 0.32;
    const targetX = -sceneState.pointer.y * 0.22;
    const k = 1 - Math.exp(-3 * dt);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, k);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, k);
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
  });

  return (
    <group ref={group}>
      <GlassShell />
      <Shards />
      <Core />
      <Rings />
      <Particles />
    </group>
  );
}



