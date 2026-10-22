import { NextResponse } from "next/server";
import { listRecords, listWellness, deleteRecord, saveWellness } from "@/lib/db";
import { capabilities } from "@/lib/env";
import type { WellnessLog } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/records?patientId=... — timeline data for one patient. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get("patientId") || "patient-1";
    const [records, wellness] = await Promise.all([
      listRecords(patientId),
      listWellness(patientId),
    ]);
    return NextResponse.json({ records, wellness, capabilities: capabilities() });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not load records.", detail: String((err as Error)?.message || err) },
      { status: 500 },
    );
  }
}

/** POST /api/records — append a wellness log. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const patientId: string = (body?.patientId || "patient-1").toString();
    const log: WellnessLog = {
      id: "well_" + Date.now().toString(36),
      date: (body?.date || new Date().toISOString().slice(0, 10)).toString(),
      bp: (body?.bp || "").toString(),
      sugar: (body?.sugar || "").toString(),
      wt: (body?.wt || "").toString(),
      note: (body?.note || "").toString(),
    };
    await saveWellness(patientId, log);
    return NextResponse.json({ ok: true, log }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not save the wellness log.", detail: String((err as Error)?.message || err) },
      { status: 500 },
    );
  }
}

/** DELETE /api/records?id=... */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const patientId = url.searchParams.get("patientId") || "patient-1";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const ok = await deleteRecord(patientId, id);
    return NextResponse.json({ ok });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not delete the record.", detail: String((err as Error)?.message || err) },
      { status: 500 },
    );
  }
}
