import { NextResponse } from "next/server";
import { runSelfCheck } from "@/lib/selftest";
import { capabilities } from "@/lib/env";

export const runtime = "nodejs";

/** GET /api/health — live diagnostics for the running deployment. */
export async function GET() {
  const checks = runSelfCheck();
  const passed = checks.filter((c) => c.pass).length;
  return NextResponse.json({
    status: passed === checks.length ? "ok" : "degraded",
    checks,
    passed,
    total: checks.length,
    capabilities: capabilities(),
    time: new Date().toISOString(),
  });
}
