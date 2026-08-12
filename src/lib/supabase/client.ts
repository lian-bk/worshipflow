// Supabase client for use in the BROWSER (Client Components).
// Uses the public anon key, which is safe to expose — access is controlled by
// Row Level Security policies in the database, not by keeping this key secret.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
