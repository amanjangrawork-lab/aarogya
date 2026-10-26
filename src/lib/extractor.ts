import { COMMON_MEDICINES, DIAGNOSIS_MAP, LAB_REFERENCE } from "./reference";
import type {
  Confidence,
  DocType,
  ExtractedDiagnosis,
  ExtractedLab,
  ExtractedMedicine,
  HealthRecord,
  LabFlag,
} from "./types";

export function normalizeText(t: string): string {
  return (t || "").replace(/\r/g, "\n").replace(/[\t ]+/g, " ").trim();
}

export function extractDates(text: string): string[] {
  const out = new Set<string>();
  const patterns = [
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g,
    /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g,
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/gi,
    /\b(\d{1,2}[\s\-\/.]*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/.]*\d{2,4})\b/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      out.add(m[0].trim());
      if (out.size >= 8) break;
    }
    if (out.size >= 8) break;
  }
  return [...out].slice(0, 8);
}

const DOSE_RE = /(\d+(?:\.\d+)?\s?(?:mg|mcg|µg|g|ml|iu|units?))\b/i;
const FREQ_RE =
  /(\d\s*[-–]\s*\d\s*[-–]\s*\d|\d\s*[-–]\s*\d|\bOD\b|\bBD\b|\bTDS\b|\bQID\b|\bHS\b|S\.?O\.?S|once daily|twice daily|thrice|at bedtime|before food|after food|1-0-1|1-1-1|0-0-1|1-0-0)/i;
const DAYS_RE = /(?:x|for|\u00d7)\s*(\d{1,3})\s*(?:days?|weeks?)/i;

export function extractMedicines(text: string): ExtractedMedicine[] {
  const lower = text.toLowerCase();
  const found: ExtractedMedicine[] = [];
  for (const med of COMMON_MEDICINES) {
    const esc = med.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const idx = lower.search(new RegExp("\\b" + esc + "\\b"));
    if (idx === -1) continue;
    const window = text.slice(idx + med.length, idx + med.length + 70);
    if (/\(\s*ref\b/i.test(window)) continue;
    const doseMatch = window.match(DOSE_RE);
    const freqMatch = window.match(FREQ_RE);
    const daysMatch = window.match(DAYS_RE);
    const hasDose = !!doseMatch;
    const hasFreq = !!freqMatch;
    const confidence: Confidence = hasDose && hasFreq ? "high" : hasDose || hasFreq ? "medium" : "low";
    found.push({
      name: med.replace(/\b\w/g, (c) => c.toUpperCase()),
      dosage: doseMatch ? doseMatch[1].trim() : "as written",
      frequency: freqMatch ? freqMatch[1].trim() : "as directed",
      duration: daysMatch ? daysMatch[1] + " days" : "",
      evidence: window.trim().slice(0, 90),
      span: (med + " " + window.trim()).slice(0, 120),
      confidence,
      needsReview: confidence !== "high",
      null_reason: confidence === "low" ? "dose/schedule not legible — confirm with prescription" : "",
    });
  }
  const genericRe =
    /\b(?:Tab|Tablet|Cap|Capsule|Syp|Syrup|Inj|Injection)\.?\s+([A-Z][A-Za-z\- ]{2,30}?)\s+(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|IU))\b/g;
  let m: RegExpExecArray | null;
  while ((m = genericRe.exec(text)) !== null) {
    const name = m[1].trim();
    if (name.length < 3) continue;
    if (found.some((f) => f.name.toLowerCase() === name.toLowerCase())) continue;
    if (/blood|report|test|hospital|doctor|patient|date|age|weight/i.test(name)) continue;
    found.push({
      name,
      dosage: m[2].trim(),
      frequency: "as directed",
      duration: "",
      evidence: m[0],
      span: m[0],
      confidence: "low",
      needsReview: true,
      null_reason: "generic pattern — verify name/dose",
    });
    if (found.length > 20) break;
  }
  return found.slice(0, 20);
}

export function extractLabs(text: string): ExtractedLab[] {
  const results: ExtractedLab[] = [];
  const cleaned = text.replace(/,/g, "");
  for (const ref of LAB_REFERENCE) {
    for (const alias of ref.names) {
      const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        esc +
          "\\s*(?:\\([^)]*\\))?\\s*[:\\-–=]?\\s*(\\d+(?:\\.\\d+)?)\\s*(" +
          ref.unit.replace(/\//g, "\\/").replace("µ", "µ?").replace(/\./g, "\\.") +
          ")?",
        "i",
      );
      const m = cleaned.match(re);
      if (!m) continue;
      const value = parseFloat(m[1]);
      if (Number.isNaN(value)) continue;
      let flag: LabFlag = "normal";
      if (value < ref.low) flag = "low";
      else if (value > (ref.borderlineHigh ?? ref.high)) flag = ref.key === "hdl" ? "normal" : "high";
      else if (value > ref.high) flag = ref.key === "hdl" ? "low" : "borderline";
      if (ref.key === "hdl" && value < ref.low) flag = "low";
      else if (ref.key === "hdl" && value >= ref.low) flag = "normal";
      const unitFound = !!m[2];
      results.push({
        key: ref.key,
        test: ref.display,
        value,
        unit: unitFound ? ref.unit : m[2] || ref.unit,
        low: ref.low,
        high: ref.high,
        flag,
        loinc: ref.loinc,
        meaning: ref.meaning,
        span: m[0].slice(0, 120),
        confidence: unitFound ? "high" : "medium",
        needsReview: !unitFound,
        source: alias,
      });
      break;
    }
  }
  const bpCtx =
    text.match(/(?:\bbp\b|blood pressure)[^0-9]{0,25}(\d{2,3})\s*\/\s*(\d{2,3})/i) ||
    text.match(/(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mm\s*hg|mmhg)/i);
  if (bpCtx) {
    const sys = parseInt(bpCtx[1], 10);
    const dia = parseInt(bpCtx[2], 10);
    const ref = LAB_REFERENCE.find((r) => r.key === "bp_sys");
    const flag: LabFlag = sys >= 140 || dia >= 90 ? "high" : sys >= 120 ? "borderline" : "normal";
    results.push({
      key: "bp",
      test: "Blood Pressure",
      value: sys + "/" + dia,
      unit: "mmHg",
      low: "90/60",
      high: "120/80",
      flag,
      loinc: "85354-9",
      meaning: ref!.meaning,
      span: bpCtx[0].slice(0, 60),
      confidence: "high",
      needsReview: false,
      source: "bp",
    });
  }
  return results;
}

export function extractDiagnoses(text: string): ExtractedDiagnosis[] {
  const lower = text.toLowerCase();
  const out: ExtractedDiagnosis[] = [];
  for (const d of DIAGNOSIS_MAP) {
    for (const alias of d.match) {
      const idx = lower.indexOf(alias);
      if (idx === -1) continue;
      const before = lower.slice(Math.max(0, idx - 30), idx);
      const after = lower.slice(idx, idx + alias.length + 20);
      if (/(negative|ruled out|\bno\b|denies|denied|absent|normal)\s*$/.test(before)) continue;
      if (/negative/.test(after.slice(0, 20))) continue;
      out.push({ display: d.display, code: d.code, system: d.system, snomed: d.snomed });
      break;
    }
  }
  return out;
}

export function detectDocType(text: string): DocType {
  const t = text.toLowerCase();
  if (/discharge summary|admission|discharged|hospital course/.test(t)) return "discharge_summary";
  if (/x-?ray|ultrasound|\busg\b|ct scan|\bmri\b|\becg\b/.test(t)) return "diagnostic_report";
  const medHits = (t.match(/\b(tab|tablet|cap|capsule|syrup|injection)\b/g) || []).length;
  if (/^\s*rx\b|\n\s*rx\b|take.*daily|1-0-1|1-1-1|0-0-1/.test(t) && medHits >= 1) return "prescription";
  if (/hba1c|cbc|lipid panel|creatinine|platelets?\s+\d|hemoglobin\s+\d|reference range|pathology|sample collected/.test(t))
    return "lab_report";
  if (/rx|tablet|tab\.|capsule|syrup|dosage|mg\b|od\b|bd\b|tds/.test(t)) return "prescription";
  if (/x-?ray|ultrasound|usg|ct scan|mri|ecg/.test(t)) return "diagnostic_report";
  return "general_record";
}

export function extractRecord(rawText: string, fileName: string): HealthRecord {
  const text = normalizeText(rawText);
  const docType = detectDocType(text);
  const docMatch = text.match(/(?:Dr\.?|Doctor)\s+([A-Z][A-Za-z .]{2,40})/);
  const hospMatch = text.match(
    /([A-Z][A-Za-z &]{3,50}(?:Hospital|Clinic|Centre|Center|Imaging|Nursing Home|Diagnostics|Labs?|Pathology))/,
  );
  return {
    id: "rec_" + Date.now().toString(36) + Math.floor(Math.random() * 999),
    fileName: fileName || "pasted-text",
    docType,
    text,
    medicines: extractMedicines(text),
    labs: extractLabs(text),
    diagnoses: extractDiagnoses(text),
    dates: extractDates(text),
    doctor: docMatch ? docMatch[1].trim().slice(0, 50) : "",
    facility: hospMatch ? hospMatch[1].trim().slice(0, 70) : "",
    createdAt: new Date().toISOString(),
  };
}
