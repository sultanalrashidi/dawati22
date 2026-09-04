import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/auth";
import { sweepAbandonedDrafts } from "@/lib/drafts/sweep";

/**
 * The nightly retention job — see `lib/drafts/sweep.ts` for what it deletes
 * and why. Scheduled from vercel.json; `?dryRun=1` rehearses without deleting,
 * which is how the first production run should be made.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const result = await sweepAbandonedDrafts({ dryRun });
  return NextResponse.json({ ok: true, dryRun, ...result });
}
