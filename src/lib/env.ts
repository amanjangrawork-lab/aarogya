/**
 * Runtime configuration. Every integration is optional: the app is fully
 * functional with no keys at all (deterministic engine + in-memory store),
 * and lights up further when Supabase and Gemini are configured.
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
};

export const hasSupabase = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const hasGemini = () => Boolean(env.geminiApiKey);

export const capabilities = () => ({
  database: hasSupabase() ? "supabase" : "in-memory",
  ai: hasGemini() ? env.geminiModel : "deterministic",
  persistence: hasSupabase() ? "durable" : "session-only",
});
