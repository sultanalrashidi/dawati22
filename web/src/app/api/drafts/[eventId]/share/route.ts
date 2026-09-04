import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveDraftAccess } from "@/lib/drafts/service";
import {
  PREVIEW_SHARE_VIEWER_LIMIT,
  countPreviewShareViewers,
  ensurePreviewShareToken,
} from "@/lib/drafts/share";

/**
 * Hands the owner her share link, minting it on first ask.
 *
 * A POST, not a GET: it creates the token, and a link that is created by being
 * fetched would be minted by any prefetch or crawl.
 *
 * `resolveDraftAccess` is the whole authorisation — it admits the owner or the
 * browser holding the draft cookie, and nobody else. It only ever resolves
 * UNPAID drafts, which is correct here: once the invitation is paid for, the
 * watermarked share link has no reason to exist.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const draft = await resolveDraftAccess(eventId);
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const token = await ensurePreviewShareToken(eventId);
  const used = await countPreviewShareViewers(eventId);

  return NextResponse.json({
    url: new URL(`/preview/share/${token}`, _request.nextUrl.origin).toString(),
    remaining: Math.max(0, PREVIEW_SHARE_VIEWER_LIMIT - used),
  });
}
