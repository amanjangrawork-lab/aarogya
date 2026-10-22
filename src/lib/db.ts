import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabase } from "./env";
import type { HealthRecord, PatientProfile, WellnessLog } from "./types";

/**
 * Storage layer.
 *
 * With Supabase configured, records persist in Postgres using an ABDM-shaped
 * schema. Without it, the same interface is served from an in-memory store so
 * the project runs (and demos) with zero configuration.
 */

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/* ------------------------------------------------------------------ */
/* In-memory fallback                                                  */
/* ------------------------------------------------------------------ */

const memory = {
  records: [] as HealthRecord[],
  wellness: [] as WellnessLog[],
  profile: {} as Partial<PatientProfile>,
};

export function memoryStore() {
  return memory;
}

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

export interface StoredRecord {
  id: string;
  patientId: string;
  fileName: string;
  docType: string;
  text: string;
  medicines: unknown[];
  labs: unknown[];
  diagnoses: unknown[];
  dates: string[];
  doctor: string;
  facility: string;
  engine: string;
  model: string | null;
  createdAt: string;
  fhir: unknown;
}

export async function listRecords(patientId: string): Promise<HealthRecord[]> {
  const sb = getSupabase();
  if (!sb) return memory.records.filter((r) => r.id.startsWith(patientId) || true);

  const { data, error } = await sb
    .from("health_records")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error || !data) return memory.records;

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    fileName: String(row.file_name),
    docType: (row.doc_type as HealthRecord["docType"]) || "general_record",
    text: String(row.text || ""),
    medicines: (row.medicines as HealthRecord["medicines"]) || [],
    labs: (row.labs as HealthRecord["labs"]) || [],
    diagnoses: (row.diagnoses as HealthRecord["diagnoses"]) || [],
    dates: (row.dates as string[]) || [],
    doctor: String(row.doctor || ""),
    facility: String(row.facility || ""),
    createdAt: String(row.created_at),
    extraction: {
      engine: (row.engine as "llm" | "deterministic") || "deterministic",
      model: (row.model as string) || undefined,
      extractedAt: String(row.created_at),
    },
  }));
}

export async function saveRecord(
  patientId: string,
  record: HealthRecord,
  fhir: unknown,
): Promise<{ stored: boolean; mode: "supabase" | "memory" }> {
  const sb = getSupabase();
  if (!sb) {
    memory.records.unshift(record);
    return { stored: false, mode: "memory" };
  }
  const { error } = await sb.from("health_records").insert({
    id: record.id,
    patient_id: patientId,
    file_name: record.fileName,
    doc_type: record.docType,
    text: record.text,
    medicines: record.medicines,
    labs: record.labs,
    diagnoses: record.diagnoses,
    dates: record.dates,
    doctor: record.doctor,
    facility: record.facility,
    engine: record.extraction?.engine || "deterministic",
    model: record.extraction?.model || null,
    fhir,
    created_at: record.createdAt,
  });
  if (error) {
    memory.records.unshift(record);
    return { stored: false, mode: "memory" };
  }
  return { stored: true, mode: "supabase" };
}

export async function deleteRecord(patientId: string, id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) {
    const before = memory.records.length;
    memory.records = memory.records.filter((r) => r.id !== id);
    return memory.records.length < before;
  }
  const { error } = await sb.from("health_records").delete().eq("id", id).eq("patient_id", patientId);
  return !error;
}

/* ------------------------------------------------------------------ */
/* Wellness                                                            */
/* ------------------------------------------------------------------ */

export async function listWellness(patientId: string): Promise<WellnessLog[]> {
  const sb = getSupabase();
  if (!sb) return memory.wellness;
  const { data, error } = await sb
    .from("wellness_logs")
    .select("*")
    .eq("patient_id", patientId)
    .order("logged_on", { ascending: false });
  if (error || !data) return memory.wellness;
  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    date: String(row.logged_on),
    bp: String(row.bp || ""),
    sugar: String(row.sugar || ""),
    wt: String(row.weight || ""),
    note: String(row.note || ""),
  }));
}

export async function saveWellness(patientId: string, log: WellnessLog): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    memory.wellness.unshift(log);
    return;
  }
  await sb.from("wellness_logs").insert({
    id: log.id,
    patient_id: patientId,
    logged_on: log.date,
    bp: log.bp,
    sugar: log.sugar,
    weight: log.wt,
    note: log.note,
    created_at: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export async function getProfile(patientId: string): Promise<Partial<PatientProfile>> {
  const sb = getSupabase();
  if (!sb) return memory.profile;
  const { data, error } = await sb.from("profiles").select("*").eq("id", patientId).maybeSingle();
  if (error || !data) return memory.profile;
  return {
    name: String(data.name || ""),
    age: String(data.age || ""),
    gender: (data.gender as PatientProfile["gender"]) || "unknown",
    phone: String(data.phone || ""),
    dob: String(data.dob || ""),
    abha: data.abha ? String(data.abha) : undefined,
    phoneLast4: data.phone_last4 ? String(data.phone_last4) : undefined,
  };
}

export async function saveProfile(patientId: string, profile: Partial<PatientProfile>): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    memory.profile = { ...memory.profile, ...profile };
    return;
  }
  await sb.from("profiles").upsert({
    id: patientId,
    name: profile.name || "",
    age: profile.age || "",
    gender: profile.gender || "unknown",
    phone: profile.phone || "",
    dob: profile.dob || "",
    abha: profile.abha || null,
    phone_last4: profile.phoneLast4 || null,
    updated_at: new Date().toISOString(),
  });
}
