// Supabase client for use on the SERVER (Server Components, Server Actions, Route
// Handlers) as the logged-in user. Reads/writes the auth cookie so the user stays
// signed in across page loads. Row Level Security still applies with this client —
// it can only see what that specific user is allowed to see.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll was called from a Server Component that can't set cookies
            // (e.g. during a page render). Safe to ignore — middleware refreshes
            // the session on the next request.
          }
        },
      },
    }
  );
}
