/**
 * OCR + PDF text extraction.
 *
 * Digital PDFs go through the pdf.js text layer (fast, exact). Scans and
 * photos fall back to Tesseract.js, which can read English, Hindi, Telugu and
 * Tamil. Every scanned PDF page is processed, not just the first.
 */
import * as pdfjsLib from "pdfjs-dist";
import { createWorker } from "tesseract.js";

let workerPromise: ReturnType<typeof createWorker> | null = null;

async function getWorker(langs: string) {
  if (!workerPromise) {
    workerPromise = createWorker(langs) as unknown as ReturnType<typeof createWorker>;
  }
  return workerPromise;
}

const LANG_MAP: Record<string, string> = { eng: "eng", hin: "hin", tel: "tel", tam: "tam" };

export async function ocrImage(
  fileOrUrl: File | Blob | string,
  onProgress?: (p: number) => void,
  ocrLang = "eng",
): Promise<string> {
  const langs = [...new Set(["eng", ...ocrLang.split("+").map((s) => LANG_MAP[s] || s)])].join("+");
  const worker = await getWorker(langs);
  const result = await worker.recognize(fileOrUrl as never, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  } as never);
  return (result.data.text || "").trim();
}

export async function extractPdfText(file: File): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let out = "";
    const n = Math.min(pdf.numPages, 12);
    for (let p = 1; p <= n; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      out +=
        tc.items
          .map((i) => ((i as { str?: string }).str || ""))
          .join(" ")
          .replace(/\s+/g, " ") + "\n";
    }
    return out.trim();
  } catch {
    return "";
  }
}

const MAX_BYTES = 10 * 1024 * 1024;

export async function extractTextFromFile(
  file: File,
  onProgress?: (p: number) => void,
  ocrLang = "eng",
): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB — over the 10 MB limit. Try a smaller photo, or split the PDF and upload pages separately.`,
    );
  }
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".txt") || file.type.startsWith("text")) return await file.text();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const txt = await extractPdfText(file);
    if (txt && txt.replace(/\s/g, "").length > 40) return txt;

    // Scanned PDF: render every page and OCR each one.
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const n = Math.min(pdf.numPages, 8);
      let out = "";
      for (let p = 1; p <= n; p++) {
        onProgress?.((p - 1) / n * 0.9);
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        const t = await ocrImage(blob!, (f) => onProgress?.((p - 1 + f) / n), ocrLang);
        out += `\n=== page ${p} ===\n` + t;
      }
      if (out.replace(/\s/g, "").length > 20) return out.trim();
    } catch {
      /* fall through to the guidance below */
    }
    if (txt) return txt;
    throw new Error(
      "No readable text in this PDF. If it is a photo-scan, check your connection (OCR data loads from a CDN), or paste the text manually.",
    );
  }

  if (file.type.startsWith("image/")) return await ocrImage(file, onProgress, ocrLang);

  try {
    const tx = await file.text();
    if (tx.trim().length > 20) return tx;
  } catch {
    /* not text */
  }
  return await ocrImage(file, onProgress, ocrLang);
}
