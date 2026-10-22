<div align="center">

# Aarogya Copilot

**Your health history, finally in one place.**

A scroll-driven 3D experience wrapped around a real clinical pipeline: OCR → trust-gated
extraction → human review → longitudinal timeline → plain-language explanation → ABDM-ready FHIR.

[![Tests](https://img.shields.io/badge/tests-15%20passing-22c55e?style=flat-square)](https://github.com/amanjangrawork-lab/aarogya-copilot)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000?style=flat-square)](https://nextjs.org/)
[![WCAG](https://img.shields.io/badge/WCAG%202.2%20AA-0ea5e9?style=flat-square)](https://www.w3.org/TR/WCAG22/)

</div>

---

## The problem

A parent's medical history lives in a shoebox: a prescription from one clinic, a lab PDF emailed
six months later, a discharge summary photographed on someone's phone. A caregiver carrying all of it
cannot answer three simple questions before the next appointment:

- What changed since last time?
- Which medicines are actually active right now?
- What should I take to the doctor?

**Aarogya Copilot turns those fragments into one trustworthy timeline.**

The differentiator is not that it reads a prescription. It is that **it shows its work**: every
extracted value carries the source text it came from, a confidence grade, and a human confirmation
step. Nothing reaches the timeline on the model's word alone.

---

## What it does

| Capability | Detail |
|---|---|
| **Ingest** | PDF (pdf.js text layer), photos and scans (Tesseract.js — English, हिन्दी, తెలుగు, தமிழ்), or pasted text. 10 MB guard, per-file and multi-page. |
| **Extraction** | Medicines with dose + schedule + duration, 14 lab tests with LOINC codes, diagnoses with ICD-10 + SNOMED CT, dates, doctor, facility, document type. |
| **Trust gate** | Every value is graded `high` / `medium` / `low` and carries a **verbatim source span**. Uncertain items never auto-save — they wait in a review queue you must approve. |
| **Reconciliation** | The same medicine with a different dose across two prescriptions is flagged, not silently merged. |
| **Timeline** | Active medicines (latest per drug), lab trend sparklines, search and filters, wellness logs (BP / sugar / weight). |
| **Explanation** | Plain-language summary with "what this abnormal value means", questions to ask the doctor, and next steps — in **English, हिन्दी, తెలుగు, தமிழ்**, with listen-aloud. Drug names, doses and units are never translated. |
| **Interoperability** | FHIR R4 bundle: Patient (ABHA identifier) + Observation (LOINC) + MedicationRequest + Condition (ICD-10/SNOMED) + DocumentReference, on ABDM NRKES profiles. Validity checked in-app. |
| **Consent** | Mock ABHA linking, a 7-day revocable share link with a stated purpose, and a full provenance ledger. |
| **Safety** | Educational-only wording, emergency tap-to-call (108 / 112), adult-general range footnotes, no diagnosis or dose advice anywhere. |

---

## The 3D layer

The landing page is not decoration. A single procedural object carries the story:

- a **glass shell** (transmission + dispersion, physically based) that protects the record
- **shards** that fly apart as you scroll — the paper fragmentation
- an **anatomical core** with a heartbeat, revealed as the shell opens
- **timeline rings** that form and then flatten into a disc
- **particles** that drift and react to the pointer

Everything is procedural geometry — no model downloads, no licensing risk, a few kilobytes.
Built with React Three Fiber, GSAP ScrollTrigger and Lenis, with a hand-written post-processing
chain (bloom → vignette + film grain → ACES output) on three's built-in `EffectComposer`.

---

## Architecture

```
┌─ Browser ────────────────────────────────────────────────────────────┐
│  Next.js 15 App Router · React 19 · Tailwind v4                       │
│                                                                     │
│  ┌─ 3D stage ─────────────┐   ┌─ Copilot app ────────────────────┐ │
│  │ R3F + three r170        │   │ Upload → OCR → Review → Summary │ │
│  │ GSAP ScrollTrigger      │   │ Timeline → Trends → FHIR export │ │
│  │ Lenis smooth scroll     │   └──────────────┬───────────────────┘ │
│  │ Custom post-processing │                  │ POST /api/extract    │
│  └────────────────────────┘                  ▼                     │
└──────────────────────────────────────────────┬──────────────────────┘
                                               │
┌─ Server (Node runtime) ───────────────────────┼──────────────────────┐
│  /api/extract  →  trust-gated extraction      │                      │
│  /api/records  →  timeline + wellness         ▼                      │
│  /api/health   →  live diagnostics      ┌─────────────┐            │
│                                           │ Gemini 2.0  │            │
│  ┌────────────────────────────────────────┴─────────────┴──────┐     │
│  │ Model proposes → deterministic validator disposes           │     │
│  │ Every span must appear verbatim in the source or be dropped │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                              │                    │                   │
│                    ┌─────────▼──────┐   ┌─────────▼────────┐         │
│                    │  Supabase      │   │ Deterministic    │         │
│                    │  Postgres      │   │ engine (fallback)│         │
│                    │  FHIR-shaped   │   │ 14 ranges, 50+   │         │
│                    │  RLS enabled   │   │ drug dictionary  │         │
│                    └────────────────┘   └──────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

**The central design rule:** *the model proposes, a deterministic validator disposes.*
When Gemini returns a value, its `span` must appear character-for-character in the source text or
the value is discarded — not trusted, not shown, discarded. The same rule governs the deterministic
engine. Both paths share one trust standard.

### Data model

The Postgres schema mirrors FHIR R4 resource shapes so export needs no translation layer:
`profiles` → Patient, `health_records` → DocumentReference, `medicines` / `labs` / `diagnoses` →
MedicationRequest / Observation / Condition, `wellness_logs` → Observation, `audit_log` → Provenance.
Row-level security scopes every table to its patient. DDL lives in
[`supabase/schema.sql`](supabase/schema.sql).

---

## Tech

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19 | One repo, one deploy, server routes hold the API keys so visitors need none |
| 3D | three r170, @react-three/fiber 9, @react-three/drei 10 | Declarative scene graph, `drei` for procedural environments with no HDRI download |
| Motion | GSAP 3.12 + ScrollTrigger, Lenis 1.1 | Scroll-linked choreography with damped, interruptible values |
| Backend | Next.js route handlers (Node runtime) | Keeps the Gemini key server-side; no separate service to deploy |
| Database | Supabase Postgres (free tier) | Real relational storage, JSONB for FHIR payloads, RLS, 500 MB free |
| AI | Gemini 2.0 Flash (free tier) | Structured JSON output; the deterministic engine covers every field |
| OCR | pdfjs-dist + tesseract.js | Digital PDFs exact, photos and scans OCR in four scripts |
| Tests | Vitest | 15 tests over the extraction engine and FHIR layer |
| A11y | axe-core | Zero WCAG 2.2 AA violations across landing, review and summary |

**Everything runs on free tiers.** With no keys configured the app still works end to end:
extraction falls back to the deterministic engine, storage falls back to memory, and
`/api/health` reports exactly which capabilities are live.

---

## Getting started

```bash
git clone https://github.com/amanjangrawork-lab/aarogya-copilot.git
cd aarogya-copilot
npm install
npm run dev          # http://localhost:3000
```

Optional configuration — copy `.env.example` to `.env.local`:

```bash
# Supabase (free) — Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Google AI Studio (free) — Create API key
GEMINI_API_KEY=
```

Then run the SQL in `supabase/schema.sql` inside the Supabase SQL editor.

### Commands

```bash
npm run dev            # dev server
npm run build          # production build
npm test               # 15 unit tests
npm run test:coverage  # coverage report
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
```

---

## Verification

- **15 unit tests** cover document classification, medicine confidence, unit detection, negation
  handling, HDL inversion, day-first date parsing and FHIR required-field validation.
- **11 built-in diagnostics** run inside the app (`GET /api/health`) over six synthetic documents
  plus four edge cases: negation, frequencies, mixed date formats and unit-missing confidence.
- **Accessibility** is checked with axe-core on the landing page, the review gate and the summary:
  zero WCAG 2.2 AA violations.
- **Visual** regression shots for the 3D story and the app flow live in `shots/`.

```bash
npm test
curl localhost:3000/api/health | jq '.passed, .total, .capabilities'
```

---

## Safety

This project organises and explains health records. It is **not** a diagnostic device, does not
generate treatment advice, and never suggests starting, stopping or changing a medicine. Reference
ranges are adult-general and always labelled as such — your lab's printed range prevails.

Only synthetic sample data is included. No real patient data is used anywhere.

---

## Repository layout

```
src/
  app/            Next.js routes: landing page + /api/extract, /api/records, /api/health
  components/
    three/        R3F scene: HealthOrb, CameraRig, PostFX, Stage
    app/          Copilot: UploadPanel, ReviewGate, SummaryPanel, DataPanel, TimelinePanel, FhirPanel
  lib/
    extractor.ts  deterministic extraction engine
    llm.ts        Gemini proxy + trust gate (verbatim span validation)
    fhir.ts       FHIR R4 bundle builder + validator
    summarizer.ts four-language plain-language summary
    ocr.ts        pdf.js + Tesseract pipeline
    reference.ts  lab ranges, LOINC, drug list, ICD-10/SNOMED map
    selftest.ts   11 in-app diagnostics
supabase/         schema.sql (FHIR-shaped, RLS enabled)
sample-data/      6 synthetic documents + a 46-check extraction matrix
scripts/          screenshot, accessibility and API test harnesses
```

---

## Licence

MIT. Sample data is synthetic and contains no real patient information.
