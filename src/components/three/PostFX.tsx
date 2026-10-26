"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/** Vignette + film grain, applied after bloom and before the output pass. */
const AtmosphereShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 0.72 },
    uGrain: { value: 0.016 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      color.rgb *= smoothstep(0.95, 0.28, dist * uVignette);
      float noise = hash(vUv * 900.0 + fract(uTime) * 100.0) - 0.5;
      color.rgb += noise * uGrain;
      gl_FragColor = color;
    }
  `,
};

/**
 * Post-processing chain: render -> bloom -> atmosphere (vignette + grain) -> output.
 * Uses three's built-in EffectComposer (no external postprocessing lib), which is
 * the only combination that stays warning-free on three r170.
 */
export function PostFX() {
  const { gl, scene, camera, size, invalidate } = useThree();

  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.3, // strength
      0.35, // radius
      0.9, // threshold
    );
    c.addPass(bloom);
    c.addPass(new ShaderPass(AtmosphereShader));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  useFrame((state) => {
    const pass = composer.passes[2] as ShaderPass;
    if (pass?.material?.uniforms?.uTime) {
      pass.material.uniforms.uTime.value = state.clock.elapsedTime;
    }
    composer.render();
    invalidate();
  }, 1);

  return null;
}
