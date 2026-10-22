"use client";

import { useRef, useState } from "react";
import { extractTextFromFile } from "@/lib/ocr";
import { SAMPLES } from "@/lib/samples";

export function UploadPanel({
  busy,
  status,
  onAnalyse,
  onLoadSample,
  onStatus,
}: {
  busy: boolean;
  status: string;
  onAnalyse: (text: string, fileName: string) => void;
  onLoadSample: (id: string) => void;
  onStatus: (message: string) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [ocrLang, setOcrLang] = useState("eng");
  const [dragOver, setDragOver] = useState(false);
  const [sample, setSample] = useState("lab");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      try {
        setProgress(0.05);
        const text = await extractTextFromFile(file, (p) => setProgress(0.05 + p * 0.9), ocrLang);
        if (!text || text.trim().length < 10) {
          throw new Error(
            "No readable text found. Try a clearer, well-lit photo with the page flat, or paste the text below.",
          );
        }
        setProgress(1);
        onAnalyse(text, file.name);
      } catch (err) {
        onStatus("⚠️ " + file.name + ": " + (err as Error).message);
      }
    }
    setTimeout(() => setProgress(0), 900);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="mb-4 text-lg font-bold">Add a health record</h3>

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragOver
            ? "border-cyan-300/70 bg-cyan-300/10"
            : "border-white/20 bg-white/[0.02] hover:border-cyan-300/50"
        }`}
      >
        <div className="text-2xl">📁</div>
        <div className="mt-2 text-sm text-slate-300">
          Drag &amp; drop a PDF, JPG or PNG — or click to browse
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          Up to 10 MB · digital PDFs read instantly · photos and scans use OCR
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
          aria-label="Choose health record files"
        />
      </div>

      {progress > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          New here? Try an example:
        </label>
        <select
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          className="rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2 text-[13px]"
          aria-label="Choose an example report"
        >
          {SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => onLoadSample(sample)}
          disabled={busy}
          className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-[13px] font-bold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
        >
          {busy ? "Reading…" : "Load example"}
        </button>
        <select
          value={ocrLang}
          onChange={(e) => setOcrLang(e.target.value)}
          className="ml-auto rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2 text-[13px]"
          aria-label="OCR language for photos and scans"
        >
          <option value="eng">English OCR</option>
          <option value="hin">+ Hindi</option>
          <option value="tel">+ Telugu</option>
          <option value="tam">+ Tamil</option>
        </select>
      </div>

      <label className="mt-4 block text-[11px] uppercase tracking-[0.18em] text-slate-500">
        Or paste report text
      </label>
      <textarea
        rows={4}
        placeholder="Paste prescription / lab / discharge text here…"
        className="mt-1 w-full rounded-xl border border-white/15 bg-[#0b1120] p-3 text-sm"
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (!text.trim()) return;
          onAnalyse(text, "pasted-text");
        }}
        aria-label="Paste report text"
      />

      <p className="mt-2 min-h-[1.2em] text-[13px] text-cyan-200/90" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
