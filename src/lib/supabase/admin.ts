// Supabase client using the SECRET service_role key. This bypasses Row Level
// Security entirely, so it must NEVER be imported into any file that runs in the
// browser — only Server Actions and Route Handlers (files that never ship to the
// client). It exists because a few actions have to happen before someone has an
// account yet, e.g. checking whether a product key is valid during registration.
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
