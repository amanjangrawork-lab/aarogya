"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sceneState, windowProgress } from "@/lib/scroll-state";

/**
 * Scroll-driven camera. Every target value is damped, so the camera glides
 * instead of snapping between acts.
 */
export function CameraRig() {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 7));

  useFrame((_, dt) => {
    const p = sceneState.progress;
    const reveal = windowProgress(p, 0.12, 0.4);
    const core = windowProgress(p, 0.28, 0.62);
    const settle = windowProgress(p, 0.62, 0.9);

    // Keep the subject the same size on any aspect ratio by pulling back on
    // narrow (portrait) viewports instead of letting it fill the frame.
    const aspect = size.width / Math.max(1, size.height);
    const portraitBoost = aspect < 1 ? 1 + (1 - aspect) * 0.95 : 1;

    // Pull in as the shell opens, orbit around the core, then pull back.
    const z =
      THREE.MathUtils.lerp(THREE.MathUtils.lerp(10.5, 8.2, reveal), 9.6, settle) * portraitBoost;
    const orbit = core * 0.85 * (1 - settle * 0.6);
    const x = Math.sin(orbit) * 1.6;
    const y = Math.cos(orbit * 0.7) * 0.6;

    // Hero: object centred and low. Acts: object drifts right so left-aligned
    // copy stays clear of it. App: back to centre.
    const heroDrop = THREE.MathUtils.lerp(-1.35, -0.15, reveal) * (aspect < 1 ? 1.25 : 1);
    const sideShift = windowProgress(p, 0.1, 0.3) * (1 - windowProgress(p, 0.82, 1)) * 2.1 * (aspect < 1 ? 0.25 : 1);

    const px = sceneState.pointer.x * 0.18;
    const py = sceneState.pointer.y * 0.12;
    target.current.set(x + sideShift + px, y + heroDrop + py, z);
    const k = 1 - Math.exp(-2.6 * dt);
    camera.position.lerp(target.current, k);
    camera.lookAt(sideShift * 0.55, heroDrop * 0.4, 0);
  });

  return null;
}
