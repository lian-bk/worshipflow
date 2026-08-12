// Next.js 16 renamed "Middleware" to "Proxy" — same feature, new file name
// (proxy.ts instead of middleware.ts) and export name (proxy instead of
// middleware). This still runs on every request before a page renders.
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
