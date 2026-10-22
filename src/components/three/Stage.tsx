"use client";

import { Canvas } from "@react-three/fiber";
import { Scene } from "./Scene";

/**
 * WebGL stage. DPR is capped at 2, antialiasing on, and a static fallback is
 * provided for browsers without WebGL so the page never renders blank.
 */
export function Stage() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }}
      camera={{ fov: 32, position: [0, 0, 7], near: 0.1, far: 120 }}
      fallback={<div className="h-full w-full bg-[#05070d]" aria-hidden="true" />}
    >
      <Scene />
    </Canvas>
  );
}
