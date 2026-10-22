const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "src", "lib");

/* summarizer: keep the exact 4-language copy, just add types + exports. */
let s = fs.readFileSync(path.join(src, "summarizer.raw.js"), "utf8");
s = s.replace(
  /^\/\*[\s\S]*?\*\/\s*/,
  `import type { HealthRecord, Lang } from "./types";\n\n`,
);
s = s.replace("const DISCLAIMER = {", "export const DISCLAIMER: Record<Lang, string> = {");
s = s.replace(
  "const SECTION_TITLE = {",
  "export const SECTION_TITLE: Record<\n  string,\n  Record<Lang, string>\n> = {",
);
s = s.replace(
  "const DOC_LABEL = {",
  "export const DOC_LABEL: Record<string, Record<Lang, string>> = {",
);
s = s.replace(
  "function buildLocalSummary(rec, lang) {",
  "export interface LocalSummary {\n  lang: Lang;\n  headline: string;\n  abnormal: string[];\n  meds: string[];\n  ask: string[];\n  next: string[];\n  disclaimer: string;\n}\n\nexport function buildLocalSummary(rec: HealthRecord, lang: Lang): LocalSummary {",
);
s = s.replace(
  '  lang = ["en", "hi", "te", "ta"].includes(lang) ? lang : "en";',
  '  lang = (["en", "hi", "te", "ta"] as string[]).includes(lang) ? lang : "en";',
);
s = s.replace(
  "async function enhanceWithGemini(rec, local, apiKey) {",
  "export async function enhanceWithGemini(\n  rec: HealthRecord,\n  local: LocalSummary,\n  apiKey: string,\n): Promise<string | null> {",
);
fs.writeFileSync(path.join(src, "summarizer.ts"), s, "utf8");

/* i18n */
let i = fs.readFileSync(path.join(src, "i18n.raw.js"), "utf8");
i = i.replace(
  /^\/\*[\s\S]*?\*\/\s*/,
  `import type { Lang } from "./types";\n\nexport type UIKey =\n`,
);
i = i.replace("const I18N = {", "export const I18N: Record<string, Record<string, string>> = {");
i = i.replace(
  "function t(lang, key) { return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key; }",
  "export function t(lang: string, key: string): string {\n  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;\n}",
);
fs.writeFileSync(path.join(src, "i18n.ts"), i, "utf8");

/* ocr */
let o = fs.readFileSync(path.join(src, "ocr.raw.js"), "utf8");
o = o.replace(
  /^\/\*[\s\S]*?\*\/\s*/,
  `/* OCR + PDF text layer: pdf.js first (fast, exact), Tesseract.js fallback\n   (scans/photos, English + Hindi + Telugu + Tamil). */\n`,
);
o = o.replace("async function extractPdfText(file) {", "export async function extractPdfText(file: File): Promise<string> {");
o = o.replace(
  "async function ocrImage(fileOrUrl, onProgress, ocrLang = \"eng\") {",
  "export async function ocrImage(\n  fileOrUrl: File | Blob | string,\n  onProgress?: (p: number) => void,\n  ocrLang = \"eng\",\n): Promise<string> {",
);
o = o.replace(
  "async function extractTextFromFile(file, onProgress, ocrLang) {",
  "export async function extractTextFromFile(\n  file: File,\n  onProgress?: (p: number) => void,\n  ocrLang?: string,\n): Promise<string> {",
);
fs.writeFileSync(path.join(src, "ocr.ts"), o, "utf8");

for (const f of ["summarizer.raw.js", "i18n.raw.js", "ocr.raw.js"]) {
  fs.unlinkSync(path.join(src, f));
}
console.log("CONVERTED");
