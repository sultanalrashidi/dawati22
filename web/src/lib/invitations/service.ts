import "server-only";
import { prisma } from "@/lib/db/client";
import { InvitationStatus, RsvpStatus } from "@/generated/prisma/client";
import { lockEventDetailsOp } from "@/lib/events/lock";

export class InvitationError extends Error {}

const ACCEPTED_LIKE = new Set<InvitationStatus>([
  InvitationStatus.ACCEPTED,
  InvitationStatus.VALID,
  InvitationStatus.PARTIALLY_USED,
  InvitationStatus.FULLY_USED,
]);

/** Collapses the full InvitationStatus lifecycle into the 3 buckets an owner cares about. */
export function classifyRsvp(status: InvitationStatus | null | undefined): "accepted" | "declined" | "pending" {
  if (!status) return "pending";
  if (status === InvitationStatus.DECLINED) return "declined";
  if (ACCEPTED_LIKE.has(status)) return "accepted";
  return "pending";
}

export async function getInvitationByLinkToken(linkToken: string) {
  return prisma.invitation.findUnique({
    where: { linkToken },
    include: {
      guest: true,
      // `couples` carries the joint-wedding list; the event's own groom/bride
      // columns still hold the primary couple, so callers that only read those
      // are unaffected. Pass the event to `couplesFor()` for the full list.
      event: { include: { theme: true, couples: { orderBy: { sortOrder: "asc" } } } },
    },
  });
}

const VIEW_ELIGIBLE = new Set<InvitationStatus>([InvitationStatus.DRAFT, InvitationStatus.SENT]);

export async function markViewed(invitation: {
  id: string;
  eventId: string;
  status: InvitationStatus;
  sentAt: Date | null;
}) {
  if (!VIEW_ELIGIBLE.has(invitation.status)) return;
  const now = new Date();
  // A guest is looking at it, so it was evidently delivered — whatever route
  // it took. The host may have copied the link out of the page and pasted it
  // into the family group, which touches none of the share buttons.
  const firstDelivery = invitation.sentAt === null;

  await prisma.$transaction([
    prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.VIEWED,
        viewedAt: now,
        // A real SENT keeps its original sentAt untouched.
        ...(firstDelivery ? { sentAt: now } : {}),
      },
    }),
    // Same rule as the share buttons: the first invitation that actually
    // reaches a guest freezes the event's details. This is the path that
    // catches a host who never pressed a share button at all.
    ...(firstDelivery ? [lockEventDetailsOp(invitation.eventId, now)] : []),
  ]);
}

const RSVP_BLOCKED_STATUSES = new Set<InvitationStatus>([
  InvitationStatus.BLOCKED,
  InvitationStatus.CANCELLED,
]);

export interface RsvpDetails {
  guestNameAr?: string;
  guestPhone?: string;
  /** How many of the guest's allowed seats are attending — clamped to Guest.allowedCount. */
  partySize?: number;
  messageAr?: string;
}

export async function submitRsvp(
  linkToken: string,
  response: RsvpStatus,
  details: RsvpDetails,
  meta: { ipHash?: string; userAgent?: string }
) {
  const invitation = await prisma.invitation.findUnique({
    where: { linkToken },
    include: { guest: true },
  });
  if (!invitation || invitation.guest.isBlocked) throw new InvitationError("Invitation not found");
  if (RSVP_BLOCKED_STATUSES.has(invitation.status)) {
    throw new InvitationError("This invitation cannot accept a response");
  }

  const partySize =
    response === RsvpStatus.ACCEPTED
      ? Math.min(Math.max(1, details.partySize ?? invitation.guest.allowedCount), invitation.guest.allowedCount)
      : undefined;

  await prisma.$transaction([
    prisma.rsvp.create({
      data: {
        invitationId: invitation.id,
        status: response,
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
        guestNameAr: details.guestNameAr || undefined,
        guestPhone: details.guestPhone || undefined,
        partySize,
        messageAr: details.messageAr || undefined,
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: response === RsvpStatus.ACCEPTED ? InvitationStatus.ACCEPTED : InvitationStatus.DECLINED,
        respondedAt: new Date(),
      },
    }),
  ]);
}
