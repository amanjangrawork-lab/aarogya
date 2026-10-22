"use client";

import dynamic from "next/dynamic";
import { Fragment, Suspense, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Copilot } from "@/components/app/Copilot";

// The WebGL scene is heavy: load it only in the browser, never on the server.
const Stage = dynamic(() => import("@/components/three/Stage").then((m) => m.Stage), { ssr: false });

export default function Home() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Reveal every [data-reveal] block as it enters the viewport.
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 42 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 86%", once: true },
          },
        );
      });

      // Word-by-word headline reveal.
      gsap.utils.toArray<HTMLElement>("[data-split]").forEach((el) => {
        const words = el.querySelectorAll("[data-word]");
        if (!words.length) return;
        gsap.fromTo(
          words,
          { opacity: 0.12, y: 24, filter: "blur(6px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.85,
            ease: "power3.out",
            stagger: 0.045,
            scrollTrigger: { trigger: el, start: "top 82%", once: true },
          },
        );
      });

      // The 3D canvas fades back as the real app section arrives.
      gsap.to("[data-canvas]", {
        opacity: 0.25,
        scale: 0.94,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-app]",
          start: "top bottom",
          end: "top center",
          scrub: true,
        },
      });
    }, root);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, []);

  return (
    <main ref={root} className="relative min-h-screen bg-[#05070d] text-white">
      <SmoothScroll />

      {/* Fixed WebGL stage */}
      <div data-canvas className="fixed inset-0 z-0 h-full w-full">
        <CanvasHost />
      </div>

      {/* Scroll acts */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(5,7,13,0.82)_0%,rgba(5,7,13,0.55)_45%,rgba(5,7,13,0)_75%)]"
        />
        <p className="mb-5 text-[11px] uppercase tracking-[0.42em] text-cyan-300/70">
          AI personal health copilot
        </p>
        <h1
          data-split
          className="max-w-4xl font-display text-[clamp(2.6rem,8vw,6.5rem)] leading-[0.95] tracking-tight [text-wrap:balance]"
        >
          {["Your", "health", "history,", "finally", "in", "one", "place"].map((w, i, arr) => (
            <Fragment key={w}>
              <span className="inline-block overflow-hidden pb-1">
                <span data-word className="inline-block">
                  {w}
                </span>
              </span>
              {i < arr.length - 1 ? " " : ""}
            </Fragment>
          ))}
        </h1>
        <p
          data-reveal
          className="mt-8 max-w-xl text-[15px] leading-relaxed text-slate-300/85 [text-shadow:0_2px_20px_rgba(0,0,0,0.9)]"
        >
          Upload a prescription, a lab report or a discharge summary. Every medicine, every test value,
          every date is extracted, traced back to its source, and explained in plain language — in the
          language your family actually speaks.
        </p>
        <div data-reveal className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#app"
            className="rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#05070d] transition-transform duration-150 hover:-translate-y-0.5"
          >
            Open the copilot
          </a>
          <a
            href="#promise"
            className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white/85 transition-colors duration-150 hover:border-white/50"
          >
            How it works
          </a>
        </div>
        <div data-reveal className="mt-20 flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">
          <span className="h-8 w-px bg-gradient-to-b from-white/40 to-transparent" />
          scroll
        </div>
      </section>

      <Act
        id="promise"
        eyebrow="Trust, not vibes"
        title="Every value shows its source"
        body="OCR confidence is not a footnote here, it is the interface. Each extracted medicine and test value carries the exact text it came from, a confidence grade, and a human review step. Nothing reaches the timeline without someone confirming it."
        points={[
          { k: "Span-level provenance", v: "value → source line → document → page" },
          { k: "Zero unsafe auto-fill", v: "uncertain doses can never self-save" },
          { k: "Conflict detection", v: "“this dose changed” across two prescriptions" },
        ]}
      />

      <Act
        id="core"
        eyebrow="One longitudinal record"
        title="Your body, over time"
        body="Records arrive from labs, clinics, pharmacies and discharge summaries in different formats. The copilot normalises them into one timeline: active medicines, test trends, diagnoses and the questions worth asking your doctor."
        points={[
          { k: "Active medication list", v: "latest dose per medicine, reconciled" },
          { k: "Test trends", v: "HbA1c, lipids, thyroid over months" },
          { k: "FHIR R4 export", v: "Patient, Observation, MedicationRequest" },
        ]}
      />

      <Act
        id="language"
        eyebrow="Built for Indian households"
        title="Explanation in the language you speak"
        body="English, हिन्दी, तेलुगు, தமிழ். Drug names, dosages and units are never translated or paraphrased, because a wrong milligram is worse than an untranslated word."
        points={[
          { k: "4 languages", v: "UI + summaries + listen-aloud" },
          { k: "Handwriting-aware OCR", v: "Hindi, Telugu and Tamil scripts" },
          { k: "Printable visit sheet", v: "one page for the doctor" },
        ]}
      />

      {/* The product itself */}
      <section id="app" data-app className="relative z-10 mt-10 min-h-screen bg-[#05070d] px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-[11px] uppercase tracking-[0.42em] text-cyan-300/70">The copilot</p>
          <h2 className="mb-10 max-w-2xl font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-tight">
            Try it on a real report
          </h2>
          <AppPreview />
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-6 py-12 text-center text-xs text-slate-500">
        <p className="mx-auto max-w-2xl">
          Aarogya Copilot organises and explains health records. It is not a diagnostic device and never
          replaces a registered medical practitioner. In an emergency, call 108 or 112.
        </p>
        <p className="mt-4">
          Built with Next.js, React Three Fiber, GSAP and Supabase. Educational tool · no real patient data.
        </p>
      </footer>
    </main>
  );
}

function CanvasHost() {
  return (
    <Suspense fallback={null}>
      <Stage />
    </Suspense>
  );
}

function Act({
  id,
  eyebrow,
  title,
  body,
  points,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points: { k: string; v: string }[];
}) {
  return (
    <section id={id} className="relative z-10 flex min-h-screen items-center px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_35%_50%,rgba(5,7,13,0.85)_0%,rgba(5,7,13,0.5)_50%,rgba(5,7,13,0)_80%)]"
      />
      <div className="mx-auto w-full max-w-5xl">
        <p data-reveal className="mb-4 text-[11px] uppercase tracking-[0.42em] text-cyan-300/70">
          {eyebrow}
        </p>
        <h2
          data-split
          className="mb-6 max-w-3xl font-display text-[clamp(2rem,5vw,4rem)] leading-[1.02] [text-shadow:0_4px_40px_rgba(0,0,0,0.85)]"
        >
          <span className="inline-block">
            {title.split(" ").map((w, i, arr) => (
              <Fragment key={i}>
                <span className="inline-block overflow-hidden pb-1">
                  <span data-word className="inline-block">
                    {w}
                  </span>
                </span>
                {i < arr.length - 1 ? " " : ""}
              </Fragment>
            ))}
          </span>
        </h2>
        <p
          data-reveal
          className="mb-10 max-w-2xl text-[15px] leading-relaxed text-slate-300/80 [text-shadow:0_2px_20px_rgba(0,0,0,0.9)]"
        >
          {body}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {points.map((p) => (
            <div
              key={p.k}
              data-reveal
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
            >
              <div className="mb-1.5 text-sm font-semibold text-white">{p.k}</div>
              <div className="text-[13px] leading-relaxed text-slate-400">{p.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AppPreview() {
  return <Copilot />;
}
