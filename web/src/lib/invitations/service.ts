import "server-only";
import { prisma } from "@/lib/db/client";
import { InvitationStatus, RsvpStatus } from "@/generated/prisma/client";

export class InvitationError extends Error {}

export async function getInvitationByLinkToken(linkToken: string) {
  return prisma.invitation.findUnique({
    where: { linkToken },
    include: { guest: true, event: { include: { theme: true } } },
  });
}

const VIEW_ELIGIBLE = new Set<InvitationStatus>([InvitationStatus.DRAFT, InvitationStatus.SENT]);

export async function markViewed(invitationId: string, currentStatus: InvitationStatus) {
  if (!VIEW_ELIGIBLE.has(currentStatus)) return;
  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: InvitationStatus.VIEWED, viewedAt: new Date() },
  });
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
