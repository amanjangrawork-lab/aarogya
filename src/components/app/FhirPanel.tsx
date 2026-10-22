"use client";

import { useMemo, useState } from "react";
import type { HealthRecord, PatientProfile } from "@/lib/types";
import { buildFhirBundle, validateFhirBundle } from "@/lib/fhir";
import { mockAbhaId } from "@/lib/fhir";
import type { PendingReview } from "./Copilot";

export function FhirPanel({
  records,
  profile,
  pending,
}: {
  records: HealthRecord[];
  profile: Partial<PatientProfile>;
  pending: PendingReview | null;
}) {
  const [abha, setAbha] = useState(profile.abha || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [otpStep, setOtpStep] = useState<"idle" | "sent" | "linked">("idle");
  const [otp, setOtp] = useState("");
  const [share, setShare] = useState<{ id: string; expiry: string; scope: string; link: string } | null>(null);
  const [note, setNote] = useState("");

  const bundle = useMemo(
    () =>
      buildFhirBundle(
        {
          name: profile.name || "",
          age: profile.age || "",
          gender: profile.gender || "unknown",
          phone: profile.phone || "",
          dob: profile.dob || "",
          abha: profile.abha,
          phoneLast4: profile.phoneLast4,
        },
        records,
      ),
    [records, profile],
  );
  const validation = validateFhirBundle(bundle);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of bundle.entry) {
      const t = String(e.resource.resourceType);
      c[t] = (c[t] || 0) + 1;
    }
    return c;
  }, [bundle]);

  function download() {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aarogya-fhir-bundle.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold">ABHA (mock) + FHIR R4 bundle</h3>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-slate-300">
          ABDM NRKES profiles
        </span>
        {validation.valid ? (
          <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
            ✅ FHIR R4 valid
          </span>
        ) : (
          <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
            ⚠️ {validation.gaps.length} gap(s)
          </span>
        )}
      </div>

      <div className="mb-4 grid gap-2 text-[12px] text-slate-300 sm:grid-cols-2">
        <div>
          <b>Resources:</b>{" "}
          {Object.entries(counts)
            .map(([k, v]) => `${k} ×${v}`)
            .join(" · ")}
        </div>
        <div>
          <b>Standards:</b> FHIR R4 · LOINC · ICD-10 · SNOMED CT · ABDM NRKES
        </div>
      </div>
      {!validation.valid && (
        <p className="mb-3 text-[12px] text-amber-200">Gaps: {validation.gaps.join("; ")}</p>
      )}

      {/* ABHA mock link */}
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-400">
          Link ABHA (mock)
        </h4>
        <p className="mb-3 text-[12px] text-slate-400">
          Simulates ABDM ABHA linking. No real network call; the demo OTP is <b>123456</b>.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="10-digit mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="min-w-[160px] flex-1 rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm"
            aria-label="Mobile number for ABHA linking"
          />
          {otpStep === "idle" && (
            <button
              onClick={() => {
                if (phone.replace(/\D/g, "").length < 10) {
                  setNote("Enter a 10-digit mobile number.");
                  return;
                }
                setOtpStep("sent");
                setNote("Mock OTP sent: 123456 (demo only — no real SMS).");
              }}
              className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-bold text-slate-200"
            >
              Send OTP
            </button>
          )}
          {otpStep === "sent" && (
            <>
              <input
                placeholder="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-28 rounded-lg border border-white/15 bg-[#0b1120] px-3 py-2.5 text-sm"
                aria-label="One time password"
              />
              <button
                onClick={() => {
                  if (otp.trim() !== "123456") {
                    setNote("Wrong OTP for the demo. Hint: 123456.");
                    return;
                  }
                  const id = abha || mockAbhaId();
                  setAbha(id);
                  setOtpStep("linked");
                  setNote("ABHA linked (mock): " + id);
                }}
                className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-[#06202a]"
              >
                Verify &amp; link
              </button>
            </>
          )}
          {otpStep === "linked" && (
            <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-[12px] font-bold text-emerald-300">
              🟢 {abha}
            </span>
          )}
        </div>
      </div>

      {/* Share link */}
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-400">
          Time-bound share (mock consent)
        </h4>
        {share ? (
          <>
            <p className="mb-2 text-[12px] text-slate-300">
              🔗 Share active — expires {share.expiry.slice(0, 10)} · scope: {share.scope}
            </p>
            <p className="mb-3 break-all text-[11px] text-slate-400">{share.link}</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(share.link);
                    setNote("Share link copied.");
                  } catch {
                    setNote("Copy blocked — long-press the link to copy it.");
                  }
                }}
                className="rounded-lg border border-white/20 px-3 py-2 text-[12px] font-bold text-slate-200"
              >
                Copy link
              </button>
              <button
                onClick={() => {
                  setShare(null);
                  setNote("Share revoked — the link is no longer valid.");
                }}
                className="rounded-lg border border-red-400/30 px-3 py-2 text-[12px] font-bold text-red-300"
              >
                Revoke now
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                const exp = new Date(Date.now() + 7 * 864e5).toISOString();
                const id = "shr_" + Math.random().toString(36).slice(2, 8);
                setShare({
                  id,
                  expiry: exp,
                  scope: "care visit — records + summary",
                  link: `${window.location.origin}${window.location.pathname}#share-${id}-exp-${exp.slice(0, 10)}`,
                });
                setNote("Share link created — valid 7 days, revocable anytime.");
              }}
              className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-4 py-2.5 text-[12px] font-bold text-cyan-100"
            >
              🔗 Create 7-day share link
            </button>
            <p className="mt-2 text-[12px] text-slate-400">
              Simulates ABDM consent: time-bound, revocable, purpose-limited to a care visit.
            </p>
          </>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={download}
          className="rounded-lg bg-cyan-300 px-4 py-2.5 text-[13px] font-bold text-[#06202a]"
        >
          ⬇ Export FHIR JSON
        </button>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" });
            navigator.clipboard?.writeText(JSON.stringify(bundle, null, 2));
            void blob;
            setNote("FHIR bundle copied to clipboard.");
          }}
          className="rounded-lg border border-white/20 px-4 py-2.5 text-[13px] font-bold text-slate-200"
        >
          Copy JSON
        </button>
      </div>

      {note && <p className="mb-3 text-[12px] text-cyan-200">{note}</p>}

      <pre className="max-h-[420px] overflow-auto rounded-xl border border-white/10 bg-[#06111f] p-3 text-[11px] text-sky-100">
        {JSON.stringify(bundle, null, 2)}
      </pre>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Mock ABHA only — no real ABDM call. The bundle uses Patient + Observation (LOINC) +
        MedicationRequest + Condition (ICD-10/SNOMED CT) + DocumentReference. In production the two
        mock handlers are replaced by ABDM gateway calls; the bundle shape already conforms.
      </p>
      {pending && (
        <p className="mt-2 text-[11px] text-slate-400">
          {pending.record.fileName} is awaiting review and is not in this bundle yet.
        </p>
      )}
    </section>
  );
}
