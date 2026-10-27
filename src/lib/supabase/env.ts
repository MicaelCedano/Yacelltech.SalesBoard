export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return false;
  if (url.includes("tu-proyecto.supabase.co") || anonKey.includes("tu-anon-key")) {
    return false;
  }
  return url.startsWith("http");
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return {
    url,
    anonKey,
    isConfigured: isSupabaseConfigured(),
  };
}
