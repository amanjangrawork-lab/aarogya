import { NextResponse } from "next/server";
import { extractWithTrust } from "@/lib/llm";
import { buildFhirBundle, validateFhirBundle } from "@/lib/fhir";
import { getProfile, saveRecord } from "@/lib/db";
import { capabilities } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHARS = 40000;

/** POST /api/extract — parse a document and return a trust-gated record. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text: string = (body?.text || "").toString();
    const fileName: string = (body?.fileName || "pasted-text").toString();
    const patientId: string = (body?.patientId || "patient-1").toString();
    const persist: boolean = body?.persist !== false;

    if (!text.trim()) {
      return NextResponse.json({ error: "No text supplied." }, { status: 400 });
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { error: "Document too long. Split it into smaller pages." },
        { status: 413 },
      );
    }

    const outcome = await extractWithTrust(text.slice(0, MAX_CHARS), fileName);
    const profile = await getProfile(patientId);
    const fhir = buildFhirBundle(
      {
        name: profile.name || "",
        age: profile.age || "",
        gender: profile.gender || "unknown",
        phone: profile.phone || "",
        dob: profile.dob || "",
        abha: profile.abha,
        phoneLast4: profile.phoneLast4,
      },
      [outcome.record],
    );
    const validation = validateFhirBundle(fhir);

    let storage: { stored: boolean; mode: string } = { stored: false, mode: "memory" };
    if (persist) storage = await saveRecord(patientId, outcome.record, fhir);

    return NextResponse.json({
      record: outcome.record,
      engine: outcome.engine,
      model: outcome.model ?? null,
      rejected: outcome.rejected,
      durationMs: outcome.durationMs,
      fhir,
      fhirValidation: validation,
      storage,
      capabilities: capabilities(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Extraction failed.", detail: String((err as Error)?.message || err) },
      { status: 500 },
    );
  }
}
