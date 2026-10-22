"use client";

import type { HealthRecord, Lang } from "@/lib/types";
import { buildLocalSummary, SECTION_TITLE, type LocalSummary } from "@/lib/summarizer";

export function SummaryPanel({
  record,
  summary,
  lang,
}: {
  record: HealthRecord | null;
  summary: LocalSummary | null;
  lang: Lang;
}) {
  if (!record || !summary) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center text-sm text-slate-400">
        📤 <b className="text-slate-200">No records yet.</b>
        <div className="mt-1 text-[13px]">
          Upload a prescription, lab report or discharge summary — or load the example report above.
        </div>
      </div>
    );
  }

  const outside = record.labs.filter((l) => l.flag === "high" || l.flag === "low");
  const borderline = record.labs.filter((l) => l.flag === "borderline");
  const flagged = record.labs.filter((l) => l.flag !== "normal");
  const voiceLang = lang === "hi" ? "hi-IN" : lang === "te" ? "te-IN" : lang === "ta" ? "ta-IN" : "en-IN";

  function speak() {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        summary!.headline +
          ". " +
          flagged.map((l) => `${l.test} ${l.value} ${l.unit}, ${l.flag}`).join(". "),
      );
      u.lang = voiceLang;
      window.speechSynthesis.speak(u);
    } catch {
      /* speech not supported */
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold">What this record says</h3>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-slate-300">
          {record.fileName}
        </span>
        <button
          onClick={speak}
          className="ml-auto rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-bold text-slate-200 transition hover:border-cyan-300/60 hover:text-cyan-200"
        >
          🔊 Listen
        </button>
      </div>

      <p className="rounded-xl border-l-4 border-cyan-300 bg-cyan-300/[0.07] p-4 text-[15px] leading-relaxed">
        {summary.headline}
      </p>

      <h4 className="mb-2 mt-6 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {SECTION_TITLE.abnormal[lang]} ({outside.length} outside range · {borderline.length} borderline ·{" "}
        {record.labs.length} measured)
      </h4>
      {record.labs.length === 0 && <p className="text-sm text-slate-500">No numeric lab values found.</p>}
      <ul className="space-y-2">
        {record.labs.map((l, i) => (
          <li
            key={i}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[13px] leading-relaxed"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  l.flag === "normal"
                    ? "bg-emerald-400/15 text-emerald-300"
                    : l.flag === "borderline"
                      ? "bg-amber-400/20 text-amber-200"
                      : "bg-red-400/20 text-red-300"
                }`}
              >
                {l.flag === "normal" ? "Normal" : l.flag === "borderline" ? "Borderline" : l.flag === "high" ? "▲ High" : "▼ Low"}
              </span>
              <b>{l.test}</b> — {String(l.value)} {l.unit}
              <span className="text-slate-500">(usual {String(l.low)}–{String(l.high)})</span>
            </div>
            <div className="mt-1 text-slate-300">
              {l.meaning?.[lang] || l.meaning?.en}
            </div>
            {l.span && <div className="mt-1 text-[11px] text-slate-500">Source: “{l.span.slice(0, 80)}”</div>}
          </li>
        ))}
      </ul>

      <h4 className="mb-2 mt-6 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {SECTION_TITLE.meds[lang]}
      </h4>
      {record.medicines.length === 0 && <p className="text-sm text-slate-500">No medicines detected.</p>}
      <ul className="list-disc space-y-1 pl-5 text-[14px]">
        {record.medicines.map((m, i) => (
          <li key={i}>
            💊 <b className="translate-none">{m.name}</b> {m.dosage !== "as written" ? m.dosage : ""} ·{" "}
            {m.frequency}
            {m.duration ? ` · ${m.duration}` : ""}
          </li>
        ))}
      </ul>
      {record.medicines.length > 0 && (
        <p className="mt-2 text-[12px] text-slate-400">
          Take exactly as prescribed. Never start, stop, or change a dose without your doctor. Drug
          names are never translated.
        </p>
      )}

      <h4 className="mb-2 mt-6 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {SECTION_TITLE.ask[lang]}
      </h4>
      <ol className="list-decimal space-y-1 pl-5 text-[14px] text-slate-200">
        {summary.ask.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ol>

      <h4 className="mb-2 mt-6 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {SECTION_TITLE.next[lang]}
      </h4>
      <ul className="list-disc space-y-1 pl-5 text-[14px] text-slate-200">
        {summary.next.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>

      <p className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3 text-[12px] text-amber-100/90">
        ⚠️ {summary.disclaimer}
      </p>
      <p className="mt-2 text-[11px] text-slate-500">
        Reference ranges shown are adult-general; your lab&apos;s printed range prevails — confirm with
        your doctor.
      </p>
    </section>
  );
}
