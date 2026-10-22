"use client";

import { useState } from "react";
import type { HealthRecord } from "@/lib/types";
import type { PendingReview } from "./Copilot";

export function ReviewGate({
  pending,
  onConfirm,
  onDiscard,
}: {
  pending: PendingReview | null;
  onConfirm: (record: HealthRecord) => void;
  onDiscard: () => void;
}) {
  const [draft, setDraft] = useState<HealthRecord | null>(null);
  const record = draft ?? pending?.record ?? null;

  if (!pending || !record) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-slate-400">
        ✅ No pending reviews.
        <div className="mt-1 text-[12px] text-slate-400">
          Uncertain medicines and doses never auto-save — you confirm them first.
        </div>
      </div>
    );
  }

  const meds = record.medicines;
  const labs = record.labs;
  const uncertain = meds.filter((m) => m.needsReview).length + labs.filter((l) => l.needsReview).length;

  function setField(index: number, key: "dosage" | "frequency", value: string) {
    const base = pending!.record;
    const next: HealthRecord = {
      ...base,
      medicines: base.medicines.map((m, i) =>
        i === index ? { ...m, [key]: value, needsReview: false, confidence: "high" } : m,
      ),
    };
    setDraft(next);
  }

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.04] p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold">Review before saving</h3>
        <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
          {uncertain} to verify
        </span>
        <span className="text-[11px] text-slate-400">
          {pending.engine === "llm" ? pending.model : "deterministic engine"} ·{" "}
          {record.fileName}
        </span>
      </div>
      <p className="mb-4 text-[13px] leading-relaxed text-slate-300">
        Every value carries the exact source text it came from. <b className="text-amber-200">Amber</b>{" "}
        means low confidence — correct it or confirm it. Nothing is saved until you approve.
      </p>

      {pending.rejected.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-[12px] text-red-200">
          <b>{pending.rejected.length}</b> proposed value(s) failed the verbatim-source check and were
          discarded rather than trusted:{" "}
          {pending.rejected.map((r) => r.detail).join(", ")}
        </div>
      )}

      <h4 className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">
        Medicines ({meds.length})
      </h4>
      {meds.length === 0 && <p className="text-sm text-slate-400">No medicines detected.</p>}
      <div className="space-y-2">
        {meds.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl border p-3 ${
              m.needsReview ? "border-amber-400/50 bg-amber-400/[0.06]" : "border-white/10 bg-white/[0.02]"
            }`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <b className="translate-none">{m.name}</b>
              {m.confidence === "high" ? (
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  High
                </span>
              ) : m.confidence === "medium" ? (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                  Medium — verify
                </span>
              ) : (
                <span className="rounded-full bg-red-400/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                  Low — confirm
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Dose
                <input
                  value={m.dosage}
                  onChange={(e) => setField(i, "dosage", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm"
                />
              </label>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Schedule
                <input
                  value={m.frequency}
                  onChange={(e) => setField(i, "frequency", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm"
                />
              </label>
            </div>
            {m.span && (
              <div className="mt-2 text-[11px] text-slate-400">
                Source: “{m.span.slice(0, 90)}”
                {m.null_reason ? ` · ${m.null_reason}` : ""}
              </div>
            )}
          </div>
        ))}
      </div>

      {labs.length > 0 && (
        <>
          <h4 className="mb-2 mt-5 text-[11px] uppercase tracking-[0.18em] text-slate-300">
            Lab values ({labs.length})
          </h4>
          <ul className="space-y-1.5">
            {labs.map((l, i) => (
              <li
                key={i}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px]"
              >
                <b>{l.test}</b> — {String(l.value)} {l.unit}{" "}
                <span className="text-slate-400">(usual {String(l.low)}–{String(l.high)})</span>{" "}
                {l.flag !== "normal" && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      l.flag === "borderline"
                        ? "bg-amber-400/20 text-amber-200"
                        : "bg-red-400/20 text-red-300"
                    }`}
                  >
                    {l.flag}
                  </span>
                )}
                {l.span && <div className="mt-1 text-[11px] text-slate-400">“{l.span.slice(0, 80)}”</div>}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() => onConfirm(draft ?? pending.record)}
          className="rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-[#06202a] transition hover:bg-cyan-200"
        >
          ✅ Confirm &amp; save to timeline
        </button>
        <button
          onClick={() => {
            setDraft(null);
            onDiscard();
          }}
          className="rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-slate-300 transition hover:border-white/40"
        >
          Discard
        </button>
      </div>

      <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[12px] text-slate-400">
        ⚠️ Educational organising tool only — not medical advice. An illegible dose must be verified by
        your doctor or pharmacist before you take it.
      </p>
    </section>
  );
}
