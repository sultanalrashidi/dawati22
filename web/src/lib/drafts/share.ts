import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import { generateSecureToken } from "@/lib/security/tokens";

/**
 * Sharing the watermarked preview with a few people before paying — "let me
 * show my mother" — without it becoming a free invitation.
 *
 * The cap is on distinct VIEWERS, not on opens: the first time someone opens
 * the link they are given a viewer id in a cookie, and coming back with it
 * costs nothing. Three people, not three page loads.
 *
 * It is a soft limit by construction — a cleared cookie is a new viewer, and
 * anyone can screenshot what they see. It is not what stops the preview being
 * used as a real invitation: the watermark, the dead RSVP, the absent QR and
 * the absence of any per-guest link do that. This just keeps "show a couple of
 * people" from quietly becoming "send it to two hundred".
 */

const VIEWER_COOKIE = "dawati_preview_viewer";
const VIEWER_COOKIE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // outlives any engagement

export const PREVIEW_SHARE_VIEWER_LIMIT = 3;

/** Mints the share link's token on first use and returns it. */
export async function ensurePreviewShareToken(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { previewShareToken: true },
  });
  if (event?.previewShareToken) return event.previewShareToken;

  const token = generateSecureToken();
  // Guarded on the column still being empty so two taps in quick succession
  // cannot mint two tokens and leave the first one dangling.
  await prisma.event.updateMany({
    where: { id: eventId, previewShareToken: null },
    data: { previewShareToken: token },
  });

  const settled = await prisma.event.findUnique({
    where: { id: eventId },
    select: { previewShareToken: true },
  });
  return settled?.previewShareToken ?? token;
}

export async function countPreviewShareViewers(eventId: string): Promise<number> {
  return prisma.previewShareView.count({ where: { eventId } });
}

export type ShareVisitResult =
  | { status: "ok"; eventId: string }
  | { status: "exhausted" }
  | { status: "unknown" };

/**
 * Resolves a share link for whoever just opened it, and spends a viewer slot
 * if this is a new person.
 *
 * The owner opening her own share link does NOT spend a slot — she is checking
 * what she sent, not one of the three people she sent it to.
 *
 * ONLY call this from a route handler. It sets a cookie, and Next refuses
 * cookie writes during a page render — which is also why the share link is a
 * route handler that redirects rather than a page of its own.
 */
export async function visitPreviewShare(token: string, viewerIsOwner: boolean): Promise<ShareVisitResult> {
  const event = await prisma.event.findUnique({
    where: { previewShareToken: token },
    select: { id: true },
  });
  if (!event) return { status: "unknown" };
  if (viewerIsOwner) return { status: "ok", eventId: event.id };

  const store = await cookies();
  const existing = store.get(VIEWER_COOKIE)?.value ?? null;

  if (existing) {
    const seen = await prisma.previewShareView.findUnique({
      where: { eventId_viewerKey: { eventId: event.id, viewerKey: existing } },
      select: { id: true },
    });
    // A returning viewer never costs a second slot, however many times they
    // reopen it — that is the whole difference between "three people" and
    // "three taps".
    if (seen) return { status: "ok", eventId: event.id };
  }

  if ((await countPreviewShareViewers(event.id)) >= PREVIEW_SHARE_VIEWER_LIMIT) {
    return { status: "exhausted" };
  }

  const viewerKey = existing ?? generateSecureToken();
  try {
    await prisma.previewShareView.create({ data: { eventId: event.id, viewerKey } });
  } catch {
    // Unique on (eventId, viewerKey): two tabs opening at once race here, and
    // losing that race means this viewer is already recorded — which is the
    // outcome we wanted anyway.
  }

  if (!existing) {
    store.set(VIEWER_COOKIE, viewerKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + VIEWER_COOKIE_TTL_MS),
    });
  }

  return { status: "ok", eventId: event.id };
}
