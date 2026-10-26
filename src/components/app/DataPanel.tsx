"use client";

import { useEffect, useState } from "react";
import type { HealthRecord } from "@/lib/types";

export function DataPanel({
  records,
  onDelete,
  highlightId,
}: {
  records: HealthRecord[];
  onDelete: (id: string) => void;
  highlightId?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById("rec-" + highlightId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlightId]);

  if (!records.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center text-sm text-slate-400">
        Nothing extracted yet.
      </div>
    );
  }

  const rows = records.flatMap((rec) => [
    ...rec.medicines.map((m) => ({
      doc: rec.fileName,
      value: `${m.name} ${m.dosage}`,
      span: m.span || m.evidence || "",
      conf: m.confidence,
      status: m.userConfirmed ? "confirmed" : m.needsReview ? "needs review" : "auto",
    })),
    ...rec.labs.map((l) => ({
      doc: rec.fileName,
      value: `${l.test} ${l.value} ${l.unit}`,
      span: l.span || "",
      conf: l.confidence,
      status: l.userConfirmed ? "confirmed" : l.needsReview ? "needs review" : "auto",
    })),
  ]);

  return (
    <div className="space-y-4">
      {records.map((rec) => (
        <section
          key={rec.id}
          id={"rec-" + rec.id}
          className={`rounded-2xl border p-5 ${highlightId === rec.id ? "border-cyan-300/60 bg-cyan-300/5" : "border-white/10 bg-white/[0.03]"}`}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <b>{rec.fileName}</b>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-slate-300">
              {rec.docType.replace(/_/g, " ")}
            </span>
            <span className="text-[11px] text-slate-400">{rec.createdAt.slice(0, 10)}</span>
            <button
              onClick={() => onDelete(rec.id)}
              className="ml-auto rounded-lg border border-red-400/30 px-3 py-1.5 text-[12px] font-bold text-red-300 transition hover:bg-red-500/15"
            >
              Delete
            </button>
          </div>
          {rec.facility || rec.doctor ? (
            <div className="mb-3 text-[12px] text-slate-400">
              {[rec.facility, rec.doctor ? "Dr. " + rec.doctor : ""].filter(Boolean).join(" · ")}
            </div>
          ) : null}

          {rec.diagnoses.length > 0 && (
            <p className="mb-3 text-[13px]">
              <b>Diagnoses:</b>{" "}
              {rec.diagnoses.map((d) => `${d.display} (${d.code})`).join(", ")}
            </p>
          )}

          {rec.medicines.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-4">Medicine</th>
                    <th className="py-2 pr-4">Dose</th>
                    <th className="py-2 pr-4">Schedule</th>
                    <th className="py-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {rec.medicines.map((m, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-2 pr-4 translate-none">{m.name}</td>
                      <td className="py-2 pr-4">{m.dosage}</td>
                      <td className="py-2 pr-4">{m.frequency}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            m.confidence === "high"
                              ? "bg-emerald-400/15 text-emerald-300"
                              : m.confidence === "medium"
                                ? "bg-amber-400/20 text-amber-200"
                                : "bg-red-400/20 text-red-300"
                          }`}
                        >
                          {m.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rec.labs.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-4">Test</th>
                    <th className="py-2 pr-4">Value</th>
                    <th className="py-2 pr-4">Range</th>
                    <th className="py-2 pr-4">LOINC</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rec.labs.map((l, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-2 pr-4">{l.test}</td>
                      <td className="py-2 pr-4">
                        {String(l.value)} {l.unit}
                      </td>
                      <td className="py-2 pr-4 text-slate-400">
                        {String(l.low)}–{String(l.high)}
                      </td>
                      <td className="py-2 pr-4 text-slate-400">{l.loinc}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            l.flag === "normal"
                              ? "bg-emerald-400/15 text-emerald-300"
                              : l.flag === "borderline"
                                ? "bg-amber-400/20 text-amber-200"
                                : "bg-red-400/20 text-red-300"
                          }`}
                        >
                          {l.flag}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={() => setOpen(open === rec.id ? null : rec.id)}
            className="text-[12px] font-bold text-cyan-300/80"
          >
            {open === rec.id ? "▾ Hide" : "▸ Show"} original text (provenance)
          </button>
          {open === rec.id && (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-slate-300">
              {rec.text.slice(0, 4000)}
            </pre>
          )}
        </section>
      ))}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h4 className="mb-1 text-sm font-bold">📜 Provenance ledger ({rows.length})</h4>
        <p className="mb-3 text-[12px] text-slate-400">
          Every extracted value, its source snippet, confidence and review status. Nothing here is
          medical advice.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-4">Value</th>
                <th className="py-2 pr-4">Document</th>
                <th className="py-2 pr-4">Evidence</th>
                <th className="py-2 pr-4">Conf.</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-white/5 align-top">
                  <td className="py-2 pr-4 translate-none">{r.value}</td>
                  <td className="py-2 pr-4 text-slate-400">{r.doc}</td>
                  <td className="py-2 pr-4 text-slate-400">“{r.span.slice(0, 60)}”</td>
                  <td className="py-2 pr-4">{r.conf}</td>
                  <td className="py-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
