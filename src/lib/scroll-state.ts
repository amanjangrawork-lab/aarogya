/**
 * Mutable scene state.
 * GSAP (scroll) writes; R3F (useFrame) reads. Deliberately outside React so a
 * 60fps scroll never triggers a re-render.
 */
export interface SceneState {
  /** 0..1 across the whole scroll story. */
  progress: number;
  /** Pointer in normalised device coords, -1..1. */
  pointer: { x: number; y: number };
  /** Number of records currently held by the app, drives ring density. */
  recordCount: number;
  /** True when the visitor asked for reduced motion. */
  reduced: boolean;
}

export const sceneState: SceneState = {
  progress: 0,
  pointer: { x: 0, y: 0 },
  recordCount: 0,
  reduced: false,
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Maps global scroll progress onto a 0..1 window for one act. */
export function windowProgress(progress: number, start: number, end: number): number {
  if (end <= start) return progress >= end ? 1 : 0;
  return clamp01((progress - start) / (end - start));
}
