import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { visitPreviewShare } from "@/lib/drafts/share";
import { PREVIEW_GRANT_COOKIE, previewGrantCookieOptions } from "@/lib/drafts/grant";

/**
 * The link she sends her mother.
 *
 * A route handler rather than a page for one concrete reason: opening it has
 * to WRITE cookies — the viewer id that makes the three-viewer cap count
 * people instead of taps, and the grant that lets the preview page render for
 * someone who is neither the owner nor holding the draft cookie. Neither is
 * possible during a page render, so the accounting happens here and the
 * browser is redirected to the preview itself.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // The owner checking her own link must not burn one of her three slots.
  const [user, owned] = await Promise.all([
    getSessionUser(),
    prisma.event.findUnique({ where: { previewShareToken: token }, select: { id: true, ownerId: true } }),
  ]);
  const viewerIsOwner = Boolean(user && owned && owned.ownerId === user.id);

  const result = await visitPreviewShare(token, viewerIsOwner);

  if (result.status === "unknown") {
    return NextResponse.redirect(new URL("/ar/themes", request.url));
  }
  if (result.status === "exhausted") {
    return NextResponse.redirect(new URL("/preview/unavailable", request.url));
  }

  const response = NextResponse.redirect(new URL(`/preview/${result.eventId}`, request.url));
  // Names the one event this browser was let into. Scoped to a single id on
  // purpose: a grant is not a key to every preview on the site.
  response.cookies.set(PREVIEW_GRANT_COOKIE, result.eventId, previewGrantCookieOptions());
  return response;
}
