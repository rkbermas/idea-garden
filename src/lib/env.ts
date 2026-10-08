export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Without Supabase credentials the app runs in a browser-only demo mode. */
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
