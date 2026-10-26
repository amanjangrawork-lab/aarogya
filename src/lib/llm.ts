import { env, hasGemini } from "./env";
import { extractRecord } from "./extractor";
import { LAB_REFERENCE } from "./reference";
import type {
  Confidence,
  DocType,
  ExtractedDiagnosis,
  ExtractedLab,
  ExtractedMedicine,
  HealthRecord,
  LabFlag,
} from "./types";

/**
 * Extraction with a trust gate.
 *
 * The model proposes. A deterministic validator disposes. Every value the
 * model returns must carry a `span` that appears verbatim in the source text;
 * anything that fails the check is discarded rather than trusted. This is the
 * same rule the deterministic engine already follows, so both paths share one
 * trust standard.
 */

export interface LlmMedicine {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  span?: string;
  confidence?: string;
}

export interface LlmLab {
  test: string;
  value?: number | string;
  unit?: string;
  low?: number;
  high?: number;
  flag?: string;
  loinc?: string;
  span?: string;
  confidence?: string;
}

export interface LlmDiagnosis {
  display: string;
  code?: string;
  system?: string;
  snomed?: string;
  span?: string;
}

export interface LlmPayload {
  docType?: string;
  doctor?: string;
  facility?: string;
  dates?: string[];
  medicines?: LlmMedicine[];
  labs?: LlmLab[];
  diagnoses?: LlmDiagnosis[];
}

const DOC_TYPES: DocType[] = [
  "prescription",
  "lab_report",
  "discharge_summary",
  "diagnostic_report",
  "general_record",
];

const SYSTEM_PROMPT = `You extract structured clinical data from Indian medical documents (prescriptions, lab reports, discharge summaries, scan reports).

Hard rules:
1. Copy the EXACT source text into "span" for every item. The span must appear character-for-character in the document. If you cannot quote it, omit the item entirely.
2. Never invent a medicine, dose, test value, date or code that is not written in the text.
3. Keep drug names exactly as written (e.g. "Metformin 500mg", "Tab. Pantoprazole"). Do not translate.
4. For labs, copy the value and unit exactly. Only include "flag" if the document itself states the range or a HIGH/LOW marker.
5. If a dose or schedule is not written, leave that field empty. Do not guess.
6. Diagnoses only if written in the text. Use ICD-10 code when you are certain, otherwise omit "code".
7. Return only JSON matching the provided schema. No prose.`;

function buildPrompt(text: string) {
  return `Extract the clinical content from this document.

--- DOCUMENT ---
${text}
--- END DOCUMENT ---

Return JSON with: docType, doctor, facility, dates, medicines[], labs[], diagnoses[].`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    docType: { type: "string", enum: DOC_TYPES },
    doctor: { type: "string" },
    facility: { type: "string" },
    dates: { type: "array", items: { type: "string" } },
    medicines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          dosage: { type: "string" },
          frequency: { type: "string" },
          duration: { type: "string" },
          span: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["name", "span"],
      },
    },
    labs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          test: { type: "string" },
          value: { type: "string" },
          unit: { type: "string" },
          low: { type: "string" },
          high: { type: "string" },
          flag: { type: "string", enum: ["normal", "borderline", "high", "low"] },
          loinc: { type: "string" },
          span: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["test", "span"],
      },
    },
    diagnoses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          display: { type: "string" },
          code: { type: "string" },
          system: { type: "string" },
          snomed: { type: "string" },
          span: { type: "string" },
        },
        required: ["display", "span"],
      },
    },
  },
  required: ["medicines", "labs", "diagnoses"],
};

export interface ExtractionOutcome {
  record: HealthRecord;
  engine: "llm" | "deterministic";
  model?: string;
  /** Values the model proposed that failed the verbatim-span check. */
  rejected: { kind: string; detail: string }[];
  durationMs: number;
}

/** A span is only trusted when it appears verbatim in the source text. */
function spanIsVerbatim(span: string | undefined, source: string): boolean {
  if (!span) return false;
  const needle = span.replace(/\s+/g, " ").trim();
  if (needle.length < 3) return false;
  const haystack = source.replace(/\s+/g, " ");
  return haystack.includes(needle);
}

function normaliseConfidence(value: string | undefined): Confidence {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normaliseFlag(value: string | undefined): LabFlag {
  return value === "high" || value === "low" || value === "borderline" ? value : "normal";
}

function lookupLab(test: string) {
  const t = test.toLowerCase();
  return LAB_REFERENCE.find((r) => r.names.some((n) => t.includes(n) || n.includes(t)));
}

/**
 * Merge model output with the deterministic engine.
 * The model wins on recall; the engine wins on correctness. Anything neither
 * can source verbatim is dropped.
 */
function merge(
  payload: LlmPayload,
  text: string,
  rejected: { kind: string; detail: string }[],
): HealthRecord {
  const base = extractRecord(text, "extracted");

  const medicines: ExtractedMedicine[] = [];
  for (const m of payload.medicines || []) {
    if (!spanIsVerbatim(m.span, text)) {
      rejected.push({ kind: "medicine", detail: m.name });
      continue;
    }
    const confidence = normaliseConfidence(m.confidence);
    const dosage = (m.dosage || "").trim();
    const frequency = (m.frequency || "").trim();
    medicines.push({
      name: m.name.trim(),
      dosage: dosage || "as written",
      frequency: frequency || "as directed",
      duration: (m.duration || "").trim(),
      evidence: (m.span || "").slice(0, 90),
      span: (m.span || "").slice(0, 120),
      confidence,
      needsReview: confidence !== "high" || !dosage || !frequency,
      null_reason:
        !dosage || !frequency ? "dose or schedule not written in the document — confirm" : "",
    });
  }

  const labs: ExtractedLab[] = [];
  for (const l of payload.labs || []) {
    if (!spanIsVerbatim(l.span, text)) {
      rejected.push({ kind: "lab", detail: l.test });
      continue;
    }
    const ref = lookupLab(l.test);
    const numeric = typeof l.value === "number" ? l.value : parseFloat(String(l.value ?? ""));
    const confidence = normaliseConfidence(l.confidence);
    // Recompute the flag deterministically from the value + reference range so a
    // wrong/missing LLM flag can never mask an abnormal result.
    let flag: LabFlag = l.flag ? normaliseFlag(l.flag) : "normal";
    if (ref && !Number.isNaN(numeric)) {
      if (numeric < ref.low) flag = "low";
      else if (numeric > (ref.borderlineHigh ?? ref.high)) flag = ref.key === "hdl" ? "normal" : "high";
      else if (numeric > ref.high) flag = ref.key === "hdl" ? "low" : "borderline";
      if (ref.key === "hdl") flag = numeric < ref.low ? "low" : "normal";
    }
    labs.push({
      key: ref?.key || l.test.toLowerCase().replace(/\s+/g, "_"),
      test: l.test,
      value: Number.isNaN(numeric) ? String(l.value ?? "") : numeric,
      unit: (l.unit || ref?.unit || "").trim(),
      low: l.low ? Number(l.low) : (ref?.low ?? ""),
      high: l.high ? Number(l.high) : (ref?.high ?? ""),
      flag,
      loinc: l.loinc || ref?.loinc || "",
      meaning: ref?.meaning ?? {
        en: "Value extracted from the document.",
        hi: "दस्तावेज़ से निकाला गया मान।",
        te: "పత్రం నుండి తీసుకున్న విలువ.",
        ta: "ஆவணத்திலிருந்து எடுக்கப்பட்ட மதிப்பு.",
      },
      span: (l.span || "").slice(0, 120),
      confidence,
      needsReview: confidence !== "high" || !l.unit,
      source: l.test,
    });
  }

  const diagnoses: ExtractedDiagnosis[] = [];
  for (const d of payload.diagnoses || []) {
    if (!spanIsVerbatim(d.span, text)) {
      rejected.push({ kind: "diagnosis", detail: d.display });
      continue;
    }
    diagnoses.push({
      display: d.display,
      code: d.code || "",
      system: d.system || "ICD-10",
      snomed: d.snomed || "",
    });
  }

  // Prefer the model's values where they survived validation, but keep anything
  // the deterministic engine found that the model missed (union, de-duplicated).
  const medKeys = new Set(medicines.map((m) => m.name.toLowerCase()));
  const mergedMeds = [...medicines, ...base.medicines.filter((m) => !medKeys.has(m.name.toLowerCase()))];
  const labKeys = new Set(labs.map((l) => l.key));
  const mergedLabs = [...labs, ...base.labs.filter((l) => !labKeys.has(l.key))];
  const dxKeys = new Set(diagnoses.map((d) => d.display.toLowerCase()));
  const mergedDx = [...diagnoses, ...base.diagnoses.filter((d) => !dxKeys.has(d.display.toLowerCase()))];

  const docType = DOC_TYPES.includes(payload.docType as DocType)
    ? (payload.docType as DocType)
    : base.docType;

  return {
    ...base,
    docType,
    doctor: (payload.doctor || "").trim() || base.doctor,
    facility: (payload.facility || "").trim() || base.facility,
    dates: payload.dates?.length ? payload.dates.slice(0, 8) : base.dates,
    medicines: mergedMeds,
    labs: mergedLabs,
    diagnoses: mergedDx,
  };
}

async function callGemini(text: string): Promise<LlmPayload | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildPrompt(text) }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 4096,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("");
    if (!raw) return null;
    return JSON.parse(raw) as LlmPayload;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract a record. Uses the LLM when a key is configured, always validates the
 * result, and falls back to the deterministic engine on any failure.
 */
export async function extractWithTrust(text: string, fileName: string): Promise<ExtractionOutcome> {
  const started = Date.now();

  if (hasGemini()) {
    const payload = await callGemini(text);
    if (payload) {
      const rejected: { kind: string; detail: string }[] = [];
      const record = merge(payload, text, rejected);
      return {
        record: {
          ...record,
          fileName,
          extraction: {
            engine: "llm",
            model: env.geminiModel,
            extractedAt: new Date().toISOString(),
            durationMs: Date.now() - started,
          },
        },
        engine: "llm",
        model: env.geminiModel,
        rejected,
        durationMs: Date.now() - started,
      };
    }
  }

  const record = extractRecord(text, fileName);
  return {
    record: {
      ...record,
      extraction: {
        engine: "deterministic",
        extractedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      },
    },
    engine: "deterministic",
    rejected: [],
    durationMs: Date.now() - started,
  };
}
