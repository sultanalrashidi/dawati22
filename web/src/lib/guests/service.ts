import "server-only";
import { prisma } from "@/lib/db/client";
import { generateSecureToken } from "@/lib/security/tokens";
import { InvitationStatus } from "@/generated/prisma/client";
import { orderTerms } from "@/lib/orders/terms";

export class GuestError extends Error {}

async function assertOwnedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      order: { include: { plan: true } },
      // Only the status, to count who's still occupying a slot — see addGuest.
      guests: { select: { invitation: { select: { status: true } } } },
    },
  });
  if (!event || event.ownerId !== userId) throw new GuestError("Event not found");
  return event;
}

export async function addGuest(
  eventId: string,
  userId: string,
  input: { nameAr: string; phone?: string; allowedCount: number }
) {
  const event = await assertOwnedEvent(eventId, userId);
  // The one place capacity is enforced in the whole product. It reads the count
  // the customer PAID for, snapshotted on the order — not the plan row, which is
  // editable settings: changing a package used to resize every live event on it.
  //
  // A declined guest gives their slot back — she said no, so the host may
  // invite someone else in her place — which is also why removing a declined
  // guest must never free a slot a second time: her slot was already given
  // back the moment she declined, not when her row disappears.
  const occupiedSlots = event.guests.filter(
    (g) => g.invitation?.status !== InvitationStatus.DECLINED,
  ).length;
  if (occupiedSlots >= orderTerms(event.order).invitationCount) {
    throw new GuestError("Guest limit reached for this event's plan");
  }
  if (input.allowedCount < 1 || input.allowedCount > 20) {
    throw new GuestError("Invalid seat count");
  }

  return prisma.guest.create({
    data: {
      eventId,
      nameAr: input.nameAr,
      phone: input.phone || null,
      allowedCount: input.allowedCount,
      invitation: {
        create: {
          eventId,
          // DRAFT, not SENT: adding a guest only prepares the link. "Sent"
          // is recorded when the host actually shares it (copy / WhatsApp —
          // see markInvitationShared) or, failing that, when the guest opens
          // it — so the event page's "sent" count stops flattering a list
          // nobody has invited yet.
          status: InvitationStatus.DRAFT,
          linkToken: generateSecureToken(),
          qrToken: generateSecureToken(),
        },
      },
    },
    include: { invitation: true },
  });
}

/**
 * Records that an invitation was actually shared — the host (or the Dawati
 * team, on a team-managed event) pressed copy or WhatsApp for this guest.
 *
 * `userId` null means the caller is the admin flow, whose action has already
 * checked the role; any other caller must own the event. Idempotent: the first
 * share sets SENT + sentAt, later clicks change nothing, and a status that has
 * already moved on (VIEWED, ACCEPTED…) is never dragged back to SENT.
 */
export async function markInvitationShared(guestId: string, userId: string | null) {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      event: { select: { ownerId: true } },
      invitation: { select: { id: true, status: true, sentAt: true } },
    },
  });
  if (!guest || (userId !== null && guest.event.ownerId !== userId)) {
    throw new GuestError("Guest not found");
  }
  const invitation = guest.invitation;
  if (!invitation) return;
  if (invitation.status !== InvitationStatus.DRAFT && invitation.sentAt) return;

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      ...(invitation.status === InvitationStatus.DRAFT ? { status: InvitationStatus.SENT } : {}),
      ...(invitation.sentAt ? {} : { sentAt: new Date() }),
    },
  });
}

export async function setGuestBlocked(guestId: string, userId: string, blocked: boolean) {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: { event: true, invitation: true },
  });
  if (!guest || guest.event.ownerId !== userId) throw new GuestError("Guest not found");

  await prisma.guest.update({ where: { id: guestId }, data: { isBlocked: blocked } });
  if (guest.invitation) {
    await prisma.invitation.update({
      where: { id: guest.invitation.id },
      data: { status: blocked ? InvitationStatus.BLOCKED : InvitationStatus.SENT },
    });
  }
}

export async function deleteGuest(guestId: string, userId: string) {
  const guest = await prisma.guest.findUnique({ where: { id: guestId }, include: { event: true } });
  if (!guest || guest.event.ownerId !== userId) throw new GuestError("Guest not found");
  if (guest.checkedInCount > 0) throw new GuestError("Cannot delete a guest who already checked in");

  await prisma.guest.delete({ where: { id: guestId } });
}
