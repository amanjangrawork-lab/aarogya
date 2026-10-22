# Architecture — Aarogya Copilot

Full-stack Next.js application: a scroll-driven 3D experience wrapped around a real clinical
pipeline. One repository, one deploy.

## 1. Shape of the system

```
Browser
 ├─ Landing (3D stage)
 │   R3F + three r170 · GSAP ScrollTrigger · Lenis · custom post-processing
 │
 └─ Copilot app
     Upload / OCR → Review gate → Summary → Timeline → FHIR export
     │  POST /api/extract
     ▼
Next.js route handlers (Node runtime)
 ├─ /api/extract   trust-gated extraction
 ├─ /api/records   timeline + wellness CRUD
 └─ /api/health    live diagnostics (11 checks)
      │
      ├─ Gemini 2.0 Flash (free tier)  ← proposes
      ├─ Deterministic engine          ← fallback + reference truth
      └─ Supabase Postgres (free tier) ← FHIR-shaped storage, RLS
```

The keys never reach the browser: `GEMINI_API_KEY` and the Supabase service key are read only inside
route handlers.

## 2. The extraction pipeline

```
document bytes
   │
   ├─ .txt ─────────────────────────────► raw text
   ├─ .pdf  → pdf.js text layer ────────► raw text   (digital PDF, exact)
   │         └─ no text? render every page → Tesseract OCR (eng + hin/tel/tam)
   └─ image ────────────────────────────► Tesseract OCR
   │
   ▼
raw text ──► /api/extract
   │
   ├─ Gemini 2.0 Flash  (structured JSON output, temperature 0.1)
   │     returns: docType, doctor, facility, dates[], medicines[], labs[], diagnoses[]
   │     every item carries a `span` copied from the source
   │
   ├─ TRUST GATE (deterministic, no model involvement)
   │     for each proposed item:
   │       span present verbatim in source?  → keep, grade confidence
   │       otherwise                          → DROP, record as rejected
   │     low/medium confidence or missing dose/unit → needsReview = true
   │
   ├─ merge with deterministic engine output (model wins on recall,
   │   engine wins on correctness; both pass the same trust check)
   │
   ▼
HealthRecord  ──► FHIR R4 bundle ──► validate ──► Supabase / memory
```

### Why a trust gate

A language model asked to read a prescription will occasionally invent a dose. A regex will
occasionally miss one. Neither is acceptable for a medicine you take every day. So the model is
treated as a *proposer*: every value it returns must be traceable to a verbatim span in the source
text, checked by ordinary string matching. If it cannot be sourced, it is discarded rather than
softened with a disclaimer. The user then confirms anything still uncertain.

`src/lib/llm.ts` holds the gate; `src/lib/extractor.ts` holds the deterministic engine; both produce
the same `HealthRecord` shape with identical confidence semantics.

## 3. The 3D layer

One procedural object, four scroll acts, no downloaded assets.

| Act | Scroll | What happens |
|---|---|---|
| 1 | 0.00–0.12 | Glass shell sealed, slow drift, hero copy |
| 2 | 0.12–0.40 | Shards scatter outward, shell transparency drops, core appears |
| 3 | 0.28–0.62 | Core swells and beats, rings form |
| 4 | 0.62–0.90 | Rings align into a flat timeline disc, camera pulls back |

- **Glass shell** — `MeshPhysicalMaterial` with transmission, dispersion and iridescence.
- **Shards** — 54 tetrahedra on a Fibonacci sphere; instanced transforms, hidden until the reveal.
- **Core** — six organ-like lobes with a hot nucleus; the heartbeat is a layered sine envelope.
- **Rings** — three tori, each interpolating its own tilt toward a flat disc.
- **Particles** — 1400 additive points drifting on a spherical shell.
- **Post-processing** — three's built-in `EffectComposer`: `RenderPass` → `UnrealBloomPass` →
  custom vignette + film grain `ShaderPass` → `OutputPass` (applies ACES filmic tone mapping).

Two implementation rules that keep it smooth:

1. **No React re-render per frame.** GSAP writes progress into a mutable module (`src/lib/scroll-state.ts`);
   `useFrame` reads it. Scroll never touches React state.
2. **Everything is damped.** Positions, rotations, camera and opacity all lerp toward their target —
   nothing snaps. The camera also compensates for aspect ratio so the subject keeps its size on
   portrait screens.

`prefers-reduced-motion` disables smooth scrolling and shortens transitions; a WebGL failure falls
back to a static background rather than a blank page.

## 4. Storage

`supabase/schema.sql` defines the schema. It mirrors FHIR R4 so the bundle exports without a
translation layer.

| Table | FHIR analogue | Notes |
|---|---|---|
| `profiles` | Patient | ABHA identifier, demographics |
| `health_records` | DocumentReference | `medicines`, `labs`, `diagnoses` as JSONB, plus the whole FHIR bundle |
| `wellness_logs` | Observation | Manual BP / sugar / weight entries |
| `audit_log` | Provenance | Who read or changed what, and when |

Indexes: `(patient_id, created_at desc)` for timeline reads, GIN indexes on the JSONB payload
columns. Row-level security scopes every table to `auth.uid()`.

With no Supabase configured the same interface is served from an in-memory store, so the app runs
and demos with zero configuration. `GET /api/health` reports which mode is live.

## 5. Safety model

| Rule | Implementation |
|---|---|
| No diagnosis, no dose advice | Summariser is template-driven and hedged; nothing suggests changing a medicine |
| Uncertain values never auto-save | `needsReview` gate in the UI; saving requires an explicit Confirm |
| Every claim is traceable | Verbatim span + source document shown inline, plus a provenance ledger |
| Ranges are labelled | "adult-general; your lab's range prevails" printed under every summary |
| Emergency path | Tap-to-call 108 / 112 card, always visible, `tel:` links |
| Emergency data flow | Deterministic path only; the model is never asked to triage |

## 6. Verification

- `npm test` — 15 unit tests over classification, extraction, negation, dates and FHIR validity.
- `GET /api/health` — 11 in-app diagnostics: six synthetic documents, the FHIR bundle, and four
  edge cases (negation, frequency codes, mixed date formats, unit-missing confidence).
- `scripts/a11y.mjs` — axe-core against WCAG 2.2 AA on three views. Currently zero violations.
- `scripts/shoot.mjs` / `scripts/shoot-app.mjs` — Playwright visual capture of the 3D story and the
  app flow, used to catch layout regressions.

## 7. Deliberate limits

- Handwriting in Indic scripts is not solved. OCR handles printed text; anything ambiguous is
  surfaced for human review instead of being guessed.
- The mock ABHA flow is a simulation. The bundle shape conforms; the gateway calls do not exist.
- Reference ranges are adult-general, not lab-specific, and are labelled as such.
- Extraction is single-document. Cross-document reconciliation currently covers repeated medicine
  names, not full clinical reasoning.
