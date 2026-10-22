export type Lang = "en" | "hi" | "te" | "ta";
export const LANGS: Lang[] = ["en", "hi", "te", "ta"];

export type Confidence = "high" | "medium" | "low";
export type LabFlag = "normal" | "borderline" | "high" | "low";

export type DocType =
  | "prescription"
  | "lab_report"
  | "discharge_summary"
  | "diagnostic_report"
  | "general_record";

export interface LabReference {
  key: string;
  names: string[];
  unit: string;
  low: number;
  high: number;
  borderlineHigh?: number;
  loinc: string;
  display: string;
  meaning: Record<Lang, string>;
}

export interface DiagnosisEntry {
  match: string[];
  code: string;
  system: string;
  display: string;
  snomed: string;
}

export interface ExtractedMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  evidence: string;
  span: string;
  confidence: Confidence;
  needsReview: boolean;
  null_reason: string;
  userConfirmed?: boolean;
}

export interface ExtractedLab {
  key: string;
  test: string;
  value: number | string;
  unit: string;
  low: number | string;
  high: number | string;
  flag: LabFlag;
  loinc: string;
  meaning: Record<Lang, string>;
  span: string;
  confidence: Confidence;
  needsReview: boolean;
  source: string;
  userConfirmed?: boolean;
}

export interface ExtractedDiagnosis {
  display: string;
  code: string;
  system: string;
  snomed: string;
}

export type ExtractionEngine = "deterministic" | "llm";

export interface ExtractionMeta {
  engine: ExtractionEngine;
  model?: string;
  extractedAt: string;
  durationMs?: number;
}

export interface HealthRecord {
  id: string;
  fileName: string;
  docType: DocType;
  text: string;
  medicines: ExtractedMedicine[];
  labs: ExtractedLab[];
  diagnoses: ExtractedDiagnosis[];
  dates: string[];
  doctor: string;
  facility: string;
  createdAt: string;
  extraction?: ExtractionMeta;
}

export interface PatientProfile {
  name: string;
  age: string;
  gender: "male" | "female" | "other" | "unknown";
  phone: string;
  dob: string;
  abha?: string;
  phoneLast4?: string;
}

export interface WellnessLog {
  id: string;
  date: string;
  bp: string;
  sugar: string;
  wt: string;
  note: string;
}

export interface SelfCheckResult {
  id: string;
  pass: boolean;
  meds?: number;
  labs?: number;
  dx?: number;
  type?: string;
  trust?: boolean;
  entry?: number;
  error?: string;
}
