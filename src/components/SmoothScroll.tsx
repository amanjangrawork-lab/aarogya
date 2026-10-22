"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { sceneState } from "@/lib/scroll-state";

/**
 * Smooth scrolling (Lenis) synced to GSAP's ticker, plus a single master
 * ScrollTrigger that writes global progress into the shared scene state.
 */
export function SmoothScroll() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sceneState.reduced = reduced;

    const lenis = new Lenis({
      duration: reduced ? 0 : 1.1,
      smoothWheel: !reduced,
      touchMultiplier: 1.4,
    });
    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Master progress trigger: 0 at the top, 1 at the end of the story.
    const master = ScrollTrigger.create({
      trigger: document.body,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        sceneState.progress = self.progress;
      },
    });

    // Pointer tracking for parallax.
    const onPointer = (e: PointerEvent) => {
      sceneState.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      sceneState.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("pointermove", onPointer);
      master.kill();
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
