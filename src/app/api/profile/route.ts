import { NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/db";
import { capabilities } from "@/lib/env";
import type { PatientProfile } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get("patientId") || "patient-1";
    const profile = await getProfile(patientId);
    return NextResponse.json({ profile, capabilities: capabilities() });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not load profile.", detail: String((err as Error)?.message || err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const patientId: string = (body?.patientId || "patient-1").toString();
    const profile = (body?.profile || {}) as Partial<PatientProfile>;
    await saveProfile(patientId, profile);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not save profile.", detail: String((err as Error)?.message || err) },
      { status: 500 },
    );
  }
}