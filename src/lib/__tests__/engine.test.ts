import { describe, expect, it } from "vitest";
import { detectDocType, extractDates, extractDiagnoses, extractLabs, extractMedicines, extractRecord } from "../extractor";
import { buildFhirBundle, parseRecordDate, validateFhirBundle } from "../fhir";
import { SAMPLES } from "../samples";
import { runSelfCheck } from "../selftest";
import type { PatientProfile } from "../types";

const profile: PatientProfile = {
  name: "Ramesh Kumar",
  age: "52",
  gender: "male",
  phone: "9000000000",
  dob: "",
  abha: "91-0000-0000-0000",
  phoneLast4: "0000",
};

describe("diagnostics suite", () => {
  it("passes every built-in check (11/11)", () => {
    const res = runSelfCheck();
    const failed = res.filter((r) => !r.pass);
    expect(failed.map((f) => `${f.id}: ${f.error ?? "assertion"}`)).toEqual([]);
    expect(res.length).toBe(11);
  });
});

describe("document classification", () => {
  it("detects prescription, lab, discharge and diagnostic reports", () => {
    expect(detectDocType("Rx: Tab. Metformin 500mg 1-0-1")).toBe("prescription");
    expect(detectDocType("HbA1c 7.8 % Creatinine 1.1 mg/dL reference range")).toBe("lab_report");
    expect(detectDocType("Discharge Summary DOA 02/02/2026")).toBe("discharge_summary");
    expect(detectDocType("CHEST X-RAY PA view ECG")).toBe("diagnostic_report");
  });
});

describe("medication extraction", () => {
  it("captures dose, schedule and duration with high confidence", () => {
    const meds = extractMedicines("Tab. Metformin 500mg — 1-0-1 after food x 30 days");
    expect(meds).toHaveLength(1);
    expect(meds[0].name).toBe("Metformin");
    expect(meds[0].dosage).toBe("500mg");
    expect(meds[0].frequency).toBe("1-0-1");
    expect(meds[0].duration).toBe("30 days");
    expect(meds[0].confidence).toBe("high");
  });

  it("marks a medicine with no readable dose as low confidence and needing review", () => {
    const meds = extractMedicines("Tab. Amlodipine");
    expect(meds[0].confidence).toBe("low");
    expect(meds[0].needsReview).toBe(true);
    expect(meds[0].null_reason).toContain("not legible");
  });

  it("does not treat a lab line as a medicine", () => {
    const meds = extractMedicines("Vitamin D (25-OH) 18 ng/mL (Ref 30-100)");
    expect(meds).toHaveLength(0);
  });
});

describe("lab extraction", () => {
  it("flags high, low and borderline against reference ranges", () => {
    const labs = extractLabs("HbA1c 7.8 % (Ref 4.0-5.6) Hemoglobin 11.2 g/dL LDL 148 mg/dL");
    const by = Object.fromEntries(labs.map((l) => [l.key, l]));
    expect(by.hba1c.flag).toBe("high");
    expect(by.hemoglobin.flag).toBe("low");
    expect(by.ldl.flag).toBe("borderline");
  });

  it("captures blood pressure only with explicit context", () => {
    const labs = extractLabs("BP 140/90 mmHg on admission");
    expect(labs.find((l) => l.key === "bp")?.value).toBe("140/90");
  });

  it("inverts HDL so low reads as abnormal", () => {
    const labs = extractLabs("HDL 38 mg/dL");
    expect(labs.find((l) => l.key === "hdl")?.flag).toBe("low");
  });
});

describe("diagnosis extraction", () => {
  it("respects negation so a negative result is not a diagnosis", () => {
    const dx = extractDiagnoses("Dengue NS1 negative. No diabetes.");
    expect(dx.some((d) => /dengue/i.test(d.display))).toBe(false);
  });

  it("maps a positive mention to ICD-10 and SNOMED", () => {
    const dx = extractDiagnoses("Diagnosis: Type 2 Diabetes Mellitus, Essential Hypertension");
    expect(dx.map((d) => d.code)).toEqual(expect.arrayContaining(["E11", "I10"]));
    expect(dx[0].snomed).toBeTruthy();
  });
});

describe("date parsing", () => {
  it("reads Indian DD/MM/YYYY as day-first", () => {
    const d = parseRecordDate("05/02/2026");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCDate()).toBe(5);
  });

  it("finds multiple date formats in one document", () => {
    expect(extractDates("Visit 15-Mar-2026, review 12/04/2026, DOA 02/02/2026").length).toBeGreaterThanOrEqual(2);
  });
});

describe("FHIR R4 bundle", () => {
  it("emits Patient, Observation, MedicationRequest, Condition and DocumentReference", () => {
    const records = SAMPLES.slice(0, 2).map((s) => extractRecord(s.text, s.label));
    const bundle = buildFhirBundle(profile, records);
    const types = new Set(bundle.entry.map((e) => e.resource.resourceType));
    expect(types).toContain("Patient");
    expect(types).toContain("Observation");
    expect(types).toContain("MedicationRequest");
    expect(types).toContain("Condition");
    expect(types).toContain("DocumentReference");
  });

  it("passes its own required-field validation", () => {
    const bundle = buildFhirBundle(profile, [extractRecord(SAMPLES[0].text, SAMPLES[0].label)]);
    const v = validateFhirBundle(bundle);
    expect(v.gaps).toEqual([]);
    expect(v.valid).toBe(true);
  });

  it("carries the ABHA identifier under the ABDM system", () => {
    const bundle = buildFhirBundle(profile, []);
    const id = bundle.entry[0].resource.identifier as { system: string; value: string }[];
    expect(id.some((i) => i.system === "http://abdm.gov.in/abha" && i.value === profile.abha)).toBe(true);
  });
});

describe("date extraction cap", () => {
  it("returns at most 8 dates", () => {
    const text = "01/01/2025 02/02/2025 03/03/2025 04/04/2025 05/05/2025 06/06/2025 07/07/2025 08/08/2025 09/09/2025 10/10/2025";
    expect(extractDates(text).length).toBeLessThanOrEqual(8);
  });
});

describe("parseRecordDate", () => {
  it("handles ISO-like and textual dates", () => {
    const d = parseRecordDate("2025-05-14");
    expect(d.getUTCFullYear()).toBe(2025);
  });
});
