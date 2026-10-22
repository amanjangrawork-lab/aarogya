"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HealthRecord, Lang, PatientProfile, WellnessLog } from "@/lib/types";
import { buildLocalSummary } from "@/lib/summarizer";
import { SAMPLES } from "@/lib/samples";
import { parseRecordDate } from "@/lib/fhir";
import { UploadPanel } from "./UploadPanel";
import { ReviewGate } from "./ReviewGate";
import { SummaryPanel } from "./SummaryPanel";
import { DataPanel } from "./DataPanel";
import { TimelinePanel } from "./TimelinePanel";
import { FhirPanel } from "./FhirPanel";

export type Tab = "summary" | "review" | "data" | "timeline" | "fhir";

export interface PendingReview {
  record: HealthRecord;
  fhir: unknown;
  rejected: { kind: string; detail: string }[];
  engine: string;
  model: string | null;
}

const LS_RECORDS = "aarogya_records_v2";
const LS_LANG = "aarogya_lang";
const LS_PROFILE = "aarogya_profile";
const LS_WELLNESS = "aarogya_wellness";

const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Simple summary" },
  { id: "review", label: "🔍 Review" },
  { id: "data", label: "Extracted data" },
  { id: "timeline", label: "Health timeline" },
  { id: "fhir", label: "ABHA & FHIR" },
];

export function Copilot() {
  const [lang, setLang] = useState<Lang>("en");
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [wellness, setWellness] = useState<WellnessLog[]>([]);
  const [profile, setProfile] = useState<Partial<PatientProfile>>({});
  const [pending, setPending] = useState<PendingReview | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<{ engine: string; model: string | null } | null>(null);
  const [reviewCount, setReviewCount] = useState(0);

  /* Restore from local storage so a reload never loses the visit. */
  useEffect(() => {
    try {
      const l = localStorage.getItem(LS_LANG) as Lang | null;
      if (l) setLang(l);
      setRecords(JSON.parse(localStorage.getItem(LS_RECORDS) || "[]"));
      setWellness(JSON.parse(localStorage.getItem(LS_WELLNESS) || "[]"));
      setProfile(JSON.parse(localStorage.getItem(LS_PROFILE) || "{}"));
    } catch {
      /* corrupted storage is not worth crashing over */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_RECORDS, JSON.stringify(records));
  }, [records]);
  useEffect(() => {
    localStorage.setItem(LS_WELLNESS, JSON.stringify(wellness));
  }, [wellness]);
  useEffect(() => {
    localStorage.setItem(LS_PROFILE, JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    localStorage.setItem(LS_LANG, lang);
  }, [lang]);

  const latest = records.length ? records[records.length - 1] : null;

  const summary = useMemo(
    () => (latest ? buildLocalSummary(latest, lang) : null),
    [latest, lang],
  );

  const analyse = useCallback(
    async (text: string, fileName: string) => {
      setBusy(true);
      setStatus("Reading the document…");
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, fileName, patientId: "patient-1" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Extraction failed.");
        setEngine({ engine: data.engine, model: data.model });

        const needsReview =
          data.record.medicines.some((m: { needsReview: boolean }) => m.needsReview) ||
          data.record.labs.some((l: { needsReview: boolean }) => l.needsReview) ||
          data.rejected?.length > 0;

        setPending({
          record: data.record,
          fhir: data.fhir,
          rejected: data.rejected || [],
          engine: data.engine,
          model: data.model,
        });

        if (needsReview) {
          const uncertain =
            data.record.medicines.filter((m: { needsReview: boolean }) => m.needsReview).length +
            data.record.labs.filter((l: { needsReview: boolean }) => l.needsReview).length;
          setReviewCount(uncertain);
          setTab("review");
          setStatus(
            `${uncertain} item${uncertain === 1 ? "" : "s"} need${uncertain === 1 ? "s" : ""} your confirmation before saving.`,
          );
        } else {
          setRecords((prev) => [data.record, ...prev]);
          setPending(null);
          setReviewCount(0);
          setTab("summary");
          setStatus(
            `Extracted ${data.record.medicines.length} medicines, ${data.record.labs.length} lab values, ${data.record.diagnoses.length} diagnoses.`,
          );
        }
      } catch (err) {
        setStatus("⚠️ " + ((err as Error).message || "Could not read that document."));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const loadSample = useCallback(
    (id: string) => {
      const s = SAMPLES.find((x) => x.id === id) || SAMPLES[0];
      void analyse(s.text, `${s.label}.txt`);
    },
    [analyse],
  );

  const confirmPending = useCallback((record: HealthRecord) => {
    setRecords((prev) => [record, ...prev]);
    setPending(null);
    setReviewCount(0);
    setTab("summary");
    setStatus(
      `Saved with provenance: ${record.medicines.length} medicines, ${record.labs.length} lab values.`,
    );
  }, []);

  const discardPending = useCallback(() => {
    setPending(null);
    setReviewCount(0);
    setStatus("Discarded — nothing was saved.");
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    fetch(`/api/records?id=${encodeURIComponent(id)}&patientId=patient-1`, {
      method: "DELETE",
    }).catch(() => {});
  }, []);

  const addWellness = useCallback((log: WellnessLog) => {
    setWellness((prev) => [log, ...prev]);
    fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...log, patientId: "patient-1" }),
    }).catch(() => {});
    setTab("timeline");
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-red-500/25 bg-red-950/25 p-4">
          <div className="mb-2 text-sm font-bold text-red-200">🚨 Emergency? Call now</div>
          <div className="mb-2 flex gap-2">
            <a
              href="tel:108"
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-bold text-white transition hover:bg-red-500"
            >
              📞 108
            </a>
            <a
              href="tel:112"
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-bold text-white transition hover:bg-red-500"
            >
              📞 112
            </a>
          </div>
          <p className="text-[11px] leading-relaxed text-red-200/70">
            Chest pain, breathlessness, fainting or severe symptoms — call immediately. This app never
            replaces emergency care.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-1 flex items-center justify-between">
            <strong className="text-sm">{profile.name || "Caregiver"}</strong>
            {profile.abha && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                🟢 ABHA linked
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            {[profile.age ? profile.age + "y" : "", profile.gender || "", profile.phone || ""]
              .filter(Boolean)
              .join(" · ") || "No profile yet"}
          </div>
          <div className="mt-3 flex gap-4 text-center">
            <div>
              <b className="block text-lg">{records.length}</b>
              <span className="text-[10px] text-slate-400">records</span>
            </div>
            <div>
              <b className="block text-lg">
                {records.reduce((a, r) => a + r.medicines.length, 0)}
              </b>
              <span className="text-[10px] text-slate-400">medicines</span>
            </div>
            <div>
              <b className="block text-lg">
                {records.reduce(
                  (a, r) => a + r.labs.filter((l) => l.flag !== "normal").length,
                  0,
                )}
              </b>
              <span className="text-[10px] text-slate-400">flags</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Language
          </label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="mb-3 w-full rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm"
            aria-label="Interface language"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="te">తెలుగు</option>
            <option value="ta">தமிழ்</option>
          </select>
          <button
            onClick={() => {
              if (!confirm("Erase all records, wellness logs and profile on this device?")) return;
              setRecords([]);
              setWellness([]);
              setProfile({});
              setPending(null);
              setStatus("All local data erased.");
            }}
            className="w-full rounded-lg border border-white/15 px-3 py-2.5 text-sm text-slate-300 transition hover:border-red-400/50 hover:text-red-300"
          >
            🗑️ Erase my data
          </button>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Educational only — not medical advice. Always consult a doctor.
          </p>
        </div>

        {engine && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[11px] text-slate-400">
            <div className="mb-1 font-bold uppercase tracking-[0.18em] text-slate-400">Engine</div>
            <div>
              {engine.engine === "llm" ? (
                <>
                  🤖 {engine.model} — every value span-checked against the source
                </>
              ) : (
                <>🧮 Deterministic engine — 14 test ranges, 50+ drug dictionary</>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="min-w-0">
        <UploadPanel
          busy={busy}
          status={status}
          onAnalyse={analyse}
          onLoadSample={loadSample}
          onStatus={setStatus}
        />

        <nav className="my-5 flex flex-wrap gap-2" role="tablist" aria-label="Copilot views">
          {TABS.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={`rounded-full border px-4 py-2.5 text-[13px] font-bold transition ${
                tab === x.id
                  ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-200"
                  : "border-white/15 text-slate-300 hover:border-white/40"
              }`}
            >
              {x.label}
              {x.id === "review" && reviewCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-200">
                  {reviewCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {tab === "summary" && (
          <SummaryPanel record={latest} summary={summary} lang={lang} />
        )}
        {tab === "review" && (
          <ReviewGate pending={pending} onConfirm={confirmPending} onDiscard={discardPending} />
        )}
        {tab === "data" && <DataPanel records={records} onDelete={deleteRecord} />}
        {tab === "timeline" && (
          <TimelinePanel
            records={records}
            wellness={wellness}
            onAddWellness={addWellness}
            onOpenRecord={(id) => {
              setTab("data");
              setStatus("Opened extracted data.");
              void id;
            }}
          />
        )}
        {tab === "fhir" && (
          <FhirPanel records={records} profile={profile} pending={pending} />
        )}
      </div>
    </div>
  );
}
