"use client";

import { useMemo, useState } from "react";
import type { HealthRecord, WellnessLog } from "@/lib/types";
import { parseRecordDate } from "@/lib/fhir";

function sparkline(points: { d: string; v: number; flag: string }[], w = 170, h = 44) {
  if (points.length < 2) {
    return (
      <span className="text-[12px] text-slate-400">
        {points.length ? `1 reading: ${points[0].v}` : "no readings"}
      </span>
    );
  }
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${(i * step).toFixed(1)},${(h - 6 - ((p.v - min) / span) * (h - 14)).toFixed(1)}`,
    )
    .join(" ");
  const dots = points
    .map((p, i) => {
      const cx = (i * step).toFixed(1);
      const cy = (h - 6 - ((p.v - min) / span) * (h - 14)).toFixed(1);
      return `<circle cx="${cx}" cy="${cy}" r="3.2" fill="${p.flag === "normal" ? "#34d399" : "#f87171"}"><title>${p.d}: ${p.v}</title></circle>`;
    })
    .join("");
  const rising = vs[vs.length - 1] > vs[0];
  return (
    <div>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Trend: ${vs.join(", ")}`}
      >
        <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2" />
        <g dangerouslySetInnerHTML={{ __html: dots }} />
      </svg>
      <div className="text-[11px] text-slate-400">
        {points[0].d} → {points[points.length - 1].d}: <b>{vs[0]} → {vs[vs.length - 1]}</b>{" "}
        {rising ? "▲ rising" : vs[vs.length - 1] < vs[0] ? "▼ falling" : "stable"} (info only, not advice)
      </div>
    </div>
  );
}

export function TimelinePanel({
  records,
  wellness,
  onAddWellness,
}: {
  records: HealthRecord[];
  wellness: WellnessLog[];
  onAddWellness: (log: WellnessLog) => void;
  onOpenRecord: (id: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", bp: "", sugar: "", wt: "", note: "" });

  const { meds, trends, events } = useMemo(() => {
    const ordered = [...records].sort(
      (a, b) =>
        parseRecordDate(a.dates[0] || a.createdAt).getTime() -
        parseRecordDate(b.dates[0] || b.createdAt).getTime(),
    );
    const medMap = new Map<string, { name: string; dosage: string; frequency: string; date: string; from: string; changed: boolean; prevDosage: string }>();
    for (const r of ordered) {
      for (const m of r.medicines) {
        const key = m.name.toLowerCase();
        const prev = medMap.get(key);
        const changed = !!prev && prev.dosage !== m.dosage;
        medMap.set(key, {
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          date: r.dates[0] || r.createdAt.slice(0, 10),
          from: r.fileName,
          changed: changed || (prev?.changed ?? false),
          prevDosage: changed ? prev!.dosage : (prev?.prevDosage ?? ""),
        });
      }
    }
    const groups: Record<string, { test: string; unit: string; low: unknown; high: unknown; points: { d: string; v: number; flag: string }[] }> = {};
    for (const r of ordered) {
      const d = r.dates[0] || r.createdAt.slice(0, 10);
      for (const l of r.labs) {
        if (typeof l.value !== "number") continue;
        const g = (groups[l.key] = groups[l.key] || {
          test: l.test,
          unit: l.unit,
          low: l.low,
          high: l.high,
          points: [],
        });
        g.points.push({ d, v: l.value, flag: l.flag });
      }
    }
    const ev = [
      ...records.map((r) => ({
        kind: r.docType === "lab_report" ? "labs" : r.docType === "prescription" ? "meds" : "visits",
        date: r.dates[0] || r.createdAt.slice(0, 10),
        icon: r.docType === "lab_report" ? "🧪" : r.docType === "prescription" ? "💊" : "🏥",
        title: r.fileName,
        sub: `${r.diagnoses.map((d) => d.display).join(", ") || r.docType} · ${r.medicines.length} meds · ${
          r.labs.filter((l) => l.flag !== "normal").length
        } flags`,
      })),
      ...wellness.map((w) => ({
        kind: "wellness",
        date: w.date,
        icon: "❤️",
        title: `Wellness — BP ${w.bp || "–"}, Sugar ${w.sugar || "–"}, Wt ${w.wt || "–"}`,
        sub: w.note,
      })),
    ].sort((a, b) => parseRecordDate(a.date).getTime() - parseRecordDate(b.date).getTime());
    return { meds: [...medMap.values()], trends: Object.values(groups), events: ev };
  }, [records, wellness]);

  const q = query.trim().toLowerCase();
  const shownEvents = events.filter(
    (e) =>
      (filter === "all" || e.kind === filter) &&
      (!q || (e.title + " " + e.sub).toLowerCase().includes(q)),
  );
  const shownMeds = q ? meds.filter((m) => (m.name + m.dosage).toLowerCase().includes(q)) : meds;
  const shownTrends = q ? trends.filter((g) => g.test.toLowerCase().includes(q)) : trends;

  const FILTERS = [
    ["all", "All"],
    ["meds", "Meds"],
    ["labs", "Labs"],
    ["visits", "Visits"],
    ["wellness", "Wellness"],
  ];

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold">Unified timeline</h3>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search timeline… e.g. metformin"
          aria-label="Search timeline"
          className="min-w-[180px] flex-1 rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm"
        />
        <span className="flex flex-wrap gap-1.5">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${
                filter === id
                  ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-200"
                  : "border-white/15 text-slate-300 hover:border-white/40"
              }`}
            >
              {label}
            </button>
          ))}
        </span>
      </div>

      {shownMeds.length > 0 && (
        <>
          <h4 className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">
            💊 Currently active medicines ({shownMeds.length}) — latest per name
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-[14px]">
            {shownMeds.map((m, i) => (
              <li key={i}>
                <b className="translate-none">{m.name}</b> {m.dosage} · {m.frequency}{" "}
                {m.changed && (
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                    dose changed (was {m.prevDosage})
                  </span>
                )}{" "}
                <span className="text-[11px] text-slate-400">
                  since {m.date} · {m.from}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[12px] text-slate-400">
            Take exactly as prescribed. Never start/stop/change without your doctor.
          </p>
        </>
      )}

      {shownTrends.length > 0 && (
        <>
          <h4 className="mb-2 mt-6 text-[11px] uppercase tracking-[0.18em] text-slate-300">
            📈 Lab trends (across records)
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {shownTrends.slice(0, 6).map((g, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <b className="text-[13px]">{g.test}</b>{" "}
                <span className="text-[11px] text-slate-400">
                  usual {String(g.low)}–{String(g.high)} {g.unit}
                </span>
                <div className="mt-1">{sparkline(g.points)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {wellness.length > 1 && (
        <>
          <h4 className="mb-2 mt-6 text-[11px] uppercase tracking-[0.18em] text-slate-300">
            ❤️ Wellness trends (BP / sugar / weight)
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "BP (systolic)",
                unit: "mmHg",
                pts: [...wellness].sort((a, b) => parseRecordDate(a.date).getTime() - parseRecordDate(b.date).getTime())
                  .map((w) => {
                    const m = (w.bp || "").match(/(\d{2,3})/);
                    return m ? { d: w.date, v: parseInt(m[1], 10), flag: "normal" } : null;
                  })
                  .filter(Boolean) as { d: string; v: number; flag: string }[],
              },
              {
                label: "Sugar",
                unit: "mg/dL",
                pts: [...wellness].sort((a, b) => parseRecordDate(a.date).getTime() - parseRecordDate(b.date).getTime())
                  .map((w) => {
                    const m = (w.sugar || "").match(/(\d{2,3})/);
                    return m ? { d: w.date, v: parseInt(m[1], 10), flag: "normal" } : null;
                  })
                  .filter(Boolean) as { d: string; v: number; flag: string }[],
              },
              {
                label: "Weight",
                unit: "kg",
                pts: [...wellness].sort((a, b) => parseRecordDate(a.date).getTime() - parseRecordDate(b.date).getTime())
                  .map((w) => {
                    const m = (w.wt || "").match(/(\d{2,3}(?:\.\d)?)/);
                    return m ? { d: w.date, v: parseFloat(m[1]), flag: "normal" } : null;
                  })
                  .filter(Boolean) as { d: string; v: number; flag: string }[],
              },
            ].map((g, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <b className="text-[13px]">{g.label}</b>{" "}
                <span className="text-[11px] text-slate-400">{g.unit}</span>
                <div className="mt-1">{sparkline(g.pts)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-6 mb-2 flex items-center gap-3">
        <h4 className="text-[11px] uppercase tracking-[0.18em] text-slate-300">🕒 Events</h4>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-bold text-slate-200 transition hover:border-cyan-300/60"
        >
          + Log BP / sugar / weight
        </button>
      </div>

      {showForm && (
        <div className="mb-4 grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm"
            aria-label="Wellness date"
          />
          <input
            placeholder="BP 120/80"
            value={form.bp}
            onChange={(e) => setForm({ ...form, bp: e.target.value })}
            className="rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm"
            aria-label="Blood pressure"
          />
          <input
            placeholder="Sugar 110 mg/dL"
            value={form.sugar}
            onChange={(e) => setForm({ ...form, sugar: e.target.value })}
            className="rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm"
            aria-label="Blood sugar"
          />
          <input
            placeholder="Weight 72 kg"
            value={form.wt}
            onChange={(e) => setForm({ ...form, wt: e.target.value })}
            className="rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm"
            aria-label="Weight"
          />
          <input
            placeholder="Note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm sm:col-span-2"
            aria-label="Note"
          />
          <button
            onClick={() => {
              onAddWellness({
                id: "well_" + Date.now().toString(36),
                date: form.date || new Date().toISOString().slice(0, 10),
                bp: form.bp,
                sugar: form.sugar,
                wt: form.wt,
                note: form.note,
              });
              setForm({ date: "", bp: "", sugar: "", wt: "", note: "" });
              setShowForm(false);
            }}
            className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-[#06202a]"
          >
            Save log
          </button>
        </div>
      )}

      {shownEvents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">
          {records.length || wellness.length
            ? `No matches for “${query}”. Try clearing the search or choosing All.`
            : "Your timeline appears here — records and wellness logs in one place."}
        </p>
      ) : (
        <div className="space-y-2">
          {shownEvents.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border-l-4 border-cyan-300/70 bg-white/[0.02] px-3 py-2.5"
            >
              <span className="text-lg leading-tight">{e.icon}</span>
              <div>
                <b className="text-[13px]">{e.title}</b>
                <div className="text-[11px] text-slate-400">
                  {e.date} · {e.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

