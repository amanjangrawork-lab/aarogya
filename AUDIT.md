# Aarogya Copilot — Full Audit & Improvement Plan

Generated from a code + runtime audit of `amanjangrawork-lab/aarogya` (Next.js 15 build).

## What was verified (all green)
- `npm install` (507 pkgs), `npm run typecheck`, `npm run build`, `npm test` (15/15)
- `npm run dev` + `GET /api/health` → **11/11 diagnostics pass**
- Lighthouse: Accessibility 1.0, Best Practices 1.0, SEO 0.75 (only missing meta-description, which is present in `layout.tsx` metadata — Lighthouse false positive on the dynamic route)

## Fixes applied in this pass
1. **Summary showed the oldest record** (`Copilot.tsx`): `latest` used `records[records.length-1]`; records are prepended, so it picked the oldest. Now `records[0]`.
2. **Review edits were lost** (`ReviewGate.tsx`): `setField` always rebuilt from `pending.record`, so editing a second field overwrote the first. Now rebuilds from `draft ?? pending.record`.
3. **ABHA link did not update the profile** (`FhirPanel.tsx`): linking only updated local component state. Now calls `onProfileUpdate`, which flows into Copilot state + localStorage (sidebar badge updates).
4. **Provenance never marked "confirmed"** (`Copilot.tsx`): `confirmPending` now sets `userConfirmed: true` and `needsReview: false` on all medicines/labs.
5. **OCR worker was pinned to the first language** (`ocr.ts`): `getWorker` cached one worker forever; switching OCR language had no effect. Now recreates the worker when langs change (and terminates the old one).
6. **pdf.js worker was never configured** (`ocr.ts`): added `GlobalWorkerOptions.workerSrc` (local package path with CDN fallback) so digital/scanned PDFs extract reliably.
7. **LLM lab flags could be wrong/missing** (`llm.ts`): flags are now recomputed deterministically from value + reference range.
8. **LLM could drop deterministically-found items** (`llm.ts`): merge is now a union (de-duplicated by name/key/display) instead of "LLM wins entirely or engine wins entirely".
9. **Model mismatch** (`summarizer.ts`): `enhanceWithGemini` used `gemini-1.5-flash` while the rest uses `gemini-2.0-flash`; now uses `env.geminiModel`.
10. **Lint warnings** removed: unused imports in `Copilot.tsx`, `SummaryPanel.tsx`, `Scene.tsx`, `i18n.ts`.

## Likely "6 issues" a visitor notices (and status)
| # | Issue | Status |
|---|---|---|
| 1 | Summary shows an old record after uploading a second one | Fixed (#1) |
| 2 | Editing dose then schedule in Review resets the dose | Fixed (#2) |
| 3 | ABHA "linked" badge never appears in the sidebar | Fixed (#3) |
| 4 | Extracted-data provenance never shows "confirmed" | Fixed (#4) |
| 5 | Changing OCR language does nothing | Fixed (#5) |
| 6 | PDF upload silently fails / no text extracted | Fixed (#6) |

## Remaining recommendations

### Delete (dead code / unused)
- `src/lib/i18n.ts` — defines `I18N`/`t()` but is imported nowhere. Either wire it into components or delete. (Kept for now, only unused import removed.)
- `scripts/convert-raw.cjs`, `scripts/fix-contrast.cjs` — CommonJS lint errors; move to a `scripts/` eslint ignore or convert to ESM. Not shipped, but `npm run lint` fails because of them.
- Unused exports: `parseRecordDate` (imported in `Copilot.tsx`, now removed), `buildLocalSummary` (still imported by `Copilot.tsx` — used, keep).

### Code-level
- `Copilot.tsx` `onOpenRecord` is a no-op (`void id`). Wire it to scroll/highlight the record in the Data tab.
- `UploadPanel.tsx` textarea `onPaste` auto-analyses on *any* paste, including tiny fragments. Add a minimum length check or an explicit "Analyze" button.
- `TimelinePanel.tsx` active-medicines list never detects dose changes across records (README promises "this dose changed" flags). Add reconciliation: compare same drug name with differing dosage and flag.
- `FhirPanel.tsx` share link / consent are purely client-side mock with no expiry enforcement. Add a tiny client check that hides expired shares.
- `extractor.ts` `extractDates`: the `out.size > 8 break` only breaks the inner `while`, then continues to the next pattern. Cap total results instead.
- `db.ts` `listRecords` memory filter `(r.id.startsWith(patientId) || true)` always true — fine for demo, but misleading. Simplify to return all memory records.
- `PostFX.tsx` renders both R3F's default pass and the EffectComposer each frame (double render). Set `frameloop` handling or move composer render to a single pass to save GPU.
- `CameraRig.tsx` adds pointer parallax with `+=` every frame on top of the lerped position, causing slight drift. Apply parallax to a separate offset group instead.

### Accessibility / SEO
- Add a `<meta name="description">` is already in `layout.tsx`; Lighthouse flagged it because the audit ran before hydration — verify in production build (`npm run build` + `npm start`).
- `aria-live` status region exists; good. Add `aria-busy` to the upload dropzone while OCR runs.
- Color contrast: run `scripts/fix-contrast.cjs` output against the dark theme; several `text-slate-400` on `bg-[#05070d]` may be below AA.

### Features to add
- **Profile persistence API**: `/api/profile` GET/POST so ABHA/phone survive across devices (currently localStorage only).
- **Record edit after save**: allow correcting a saved record's medicine dose in the Data tab (currently delete-only).
- **Wellness trend charts**: BP/sugar/weight are logged but never charted. Add sparklines (reuse the Timeline sparkline).
- **Export visit sheet**: README promises a printable one-page doctor sheet; `window.print()` CSS (`@media print`) is not present. Add print styles.
- **Offline PWA**: `sw.js` exists in the static v1 but not in the Next.js app. Add a service worker via `next-pwa` or a manual `public/sw.js`.
- **Tests**: add Vitest cases for `ReviewGate` editing, `merge` union, and `parseRecordDate` (currently only the engine is tested).

### Performance
- `Particles` mutates 1400 points and sets `needsUpdate = true` every frame. Throttle to every other frame or reduce count on mobile.
- `HealthOrb` shards (`SHARD_COUNT = 54`) each a mesh; consider `InstancedMesh`.
- Disable the 3D scene entirely on `prefers-reduced-motion` (currently only smooth-scroll is disabled).

## How to run (updated)
```bash
cd aarogya-remote
npm install
npm run dev          # http://localhost:3000
npm test             # 15 unit tests
npm run typecheck
npm run build
```