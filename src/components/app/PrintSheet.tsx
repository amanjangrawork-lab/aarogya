"use client";

import type { HealthRecord } from "@/lib/types";
import { buildLocalSummary } from "@/lib/summarizer";

export function PrintSheet({ record }: { record: HealthRecord | null }) {
  if (!record) return null;
  const s = buildLocalSummary(record, "en");
  return (
    <div className="print-sheet hidden">
      <h1>Aarogya Copilot — Doctor visit sheet</h1>
      <p className="muted">Educational summary only — not medical advice. {s.disclaimer}</p>
      <h2>{record.fileName} · {record.docType.replace(/_/g, " ")} · {record.createdAt.slice(0, 10)}</h2>
      {record.doctor && <p>Doctor: Dr. {record.doctor}</p>}
      {record.facility && <p>Facility: {record.facility}</p>}
      <h3>Headline</h3>
      <p>{s.headline}</p>
      <h3>Medicines</h3>
      <ul>{record.medicines.map((m, i) => <li key={i}>{m.name} {m.dosage} — {m.frequency}{m.duration ? ", " + m.duration : ""}</li>)}</ul>
      <h3>Lab values</h3>
      <ul>{record.labs.map((l, i) => <li key={i}>{l.test}: {String(l.value)} {l.unit} (usual {String(l.low)}–{String(l.high)}) — {l.flag}</li>)}</ul>
      <h3>Questions to ask</h3>
      <ol>{s.ask.map((q, i) => <li key={i}>{q}</li>)}</ol>
      <p className="muted">Reference ranges are adult-general; your lab&apos;s printed range prevails.</p>
    </div>
  );
}