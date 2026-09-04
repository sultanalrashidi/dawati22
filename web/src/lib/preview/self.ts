import "server-only";
import { prisma } from "@/lib/db/client";
import { generateSecureToken } from "@/lib/security/tokens";
import { PREVIEW_EVENT_INCLUDE } from "@/lib/drafts/preview";

/**
 * The test invitation — her step nine, «إرسال دعوة تجريبية».
 *
 * It is a rendering of the event reached by `Event.selfPreviewToken`, backed
 * by NO Guest and NO Invitation row. That absence is the whole design:
 *
 *  - it cannot consume a paid slot, because capacity counts Guest rows and
 *    there is none;
 *  - it cannot mint a shareable guest link, because `guests/service.ts` is the
 *    only code that mints a linkToken and this never calls it;
 *  - the door scanner cannot accept it, because that resolves an
 *    `Invitation.qrToken` and there is none to resolve;
 *  - an RSVP from it records nothing, because `submitRsvp` looks up an
 *    `Invitation.linkToken` and the page never passes one.
 *
 * So the thing she can safely forward to her mother is not a stripped-down
 * imitation of the invitation — it is the invitation, with the parts that
 * would write to the database simply absent.
 */

/**
 * The event this test link belongs to, or null.
 *
 * `orderId: { not: null }` because the test invitation is a post-payment
 * feature: before activation she already has the watermarked preview, and its
 * whole point is that it says it is not the real thing.
 */
export async function resolveSelfPreview(token: string) {
  if (!token) return null;
  return prisma.event.findFirst({
    where: { selfPreviewToken: token, orderId: { not: null } },
    include: PREVIEW_EVENT_INCLUDE,
  });
}

/**
 * Her test link, minted on first use if the event has none.
 *
 * `activateDraftEvent` generates the token today, but every event activated
 * before that shipped has a null one — and the column is unique, so a blanket
 * backfill is the sort of thing that fails halfway. Minting lazily costs one
 * write, once, for those events and nothing at all for the rest.
 *
 * The compare-and-set on `selfPreviewToken: null` means two tabs asking at the
 * same moment cannot produce two tokens: the loser's update matches no row and
 * it re-reads the winner's.
 */
export async function ensureSelfPreviewToken(eventId: string, userId: string): Promise<string | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: userId, orderId: { not: null } },
    select: { selfPreviewToken: true },
  });
  if (!event) return null;
  if (event.selfPreviewToken) return event.selfPreviewToken;

  const token = generateSecureToken();
  const claimed = await prisma.event.updateMany({
    where: { id: eventId, ownerId: userId, selfPreviewToken: null },
    data: { selfPreviewToken: token },
  });
  if (claimed.count > 0) return token;

  const settled = await prisma.event.findFirst({
    where: { id: eventId, ownerId: userId },
    select: { selfPreviewToken: true },
  });
  return settled?.selfPreviewToken ?? null;
}

/**
 * A new test link, and the old one stops working.
 *
 * Worth having because this link is meant to be forwarded: once it is in a
 * family group it is wherever that group forwards it, and the only way back
 * from that is to change the token. Nothing else about the event moves.
 */
export async function rotateSelfPreviewToken(eventId: string, userId: string): Promise<string | null> {
  const token = generateSecureToken();
  const rotated = await prisma.event.updateMany({
    where: { id: eventId, ownerId: userId, orderId: { not: null } },
    data: { selfPreviewToken: token },
  });
  return rotated.count > 0 ? token : null;
}
