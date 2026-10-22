"use client";

import { useEffect } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import { HealthOrb } from "./HealthOrb";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./PostFX";

export function Scene() {
  return (
    <>
      <color attach="background" args={["#05070d"]} />
      <fog attach="fog" args={["#05070d", 9, 20]} />

      {/* Procedural environment: lightformers rendered to a cube target.
          No HDRI download, no CDN dependency, no licensing questions. */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={1.1} position={[0, 4, -6]} scale={[10, 10, 1]} color="#4aa8ff" />
        <Lightformer intensity={0.7} position={[-6, 1, 2]} scale={[6, 6, 1]} color="#7c5cff" />
        <Lightformer intensity={0.6} position={[6, -2, 2]} scale={[6, 6, 1]} color="#2ee6c5" />
        <Lightformer intensity={0.35} position={[0, -5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} color="#ff6b57" />
      </Environment>

      <ambientLight intensity={0.34} />
      <directionalLight position={[4, 6, 5]} intensity={0.85} color="#dff0ff" />
      <spotLight position={[-5, 3, 4]} angle={0.6} penumbra={1} intensity={8} color="#4aa8ff" />
      <pointLight position={[0, 0, 1.2]} intensity={2.4} color="#ff6b57" distance={4} />

      <HealthOrb />
      <CameraRig />
      <PostFX />
    </>
  );
}
