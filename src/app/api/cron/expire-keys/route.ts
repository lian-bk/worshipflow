// Hit once a day by the Vercel Cron Job defined in vercel.json. Vercel
// automatically sends "Authorization: Bearer <CRON_SECRET>" on every cron
// request once a CRON_SECRET environment variable is set on the project —
// this check exists so a random visitor can't hit this URL themselves and
// force a re-check (harmless, but there's no reason to allow it).
import { NextRequest, NextResponse } from "next/server";
import { expireOverdueKeys } from "@/lib/expire-keys";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const count = await expireOverdueKeys();
  return NextResponse.json({ expired: count });
}
