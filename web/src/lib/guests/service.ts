import "server-only";
import { prisma } from "@/lib/db/client";
import { generateSecureToken } from "@/lib/security/tokens";
import { InvitationStatus } from "@/generated/prisma/client";
import { orderTerms } from "@/lib/orders/terms";
import { lockEventDetailsOp } from "@/lib/events/lock";

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
  // THE PAYWALL. This function is the only place in the product that mints a
  // linkToken or a qrToken, so "no guest ⇒ no shareable invitation URL exists"
  // is what actually keeps an unpaid invitation unshareable — not the schema.
  // It used to be enforced by `Event.orderId` being NOT NULL; that column is
  // now nullable so a draft can exist before payment, and this is where the
  // same guarantee moved to. Capacity below would refuse a draft anyway (an
  // absent order reads as zero invitations), but only by accident of
  // arithmetic — this says it on purpose, and says it in the customer's terms.
  if (!event.orderId) throw new GuestError("Event is not activated yet");
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
      invitation: { select: { id: true, eventId: true, status: true, sentAt: true } },
    },
  });
  if (!guest || (userId !== null && guest.event.ownerId !== userId)) {
    throw new GuestError("Guest not found");
  }
  const invitation = guest.invitation;
  if (!invitation) return;
  if (invitation.status !== InvitationStatus.DRAFT && invitation.sentAt) return;

  const now = new Date();
  const firstDelivery = invitation.sentAt === null;

  await prisma.$transaction([
    prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        ...(invitation.status === InvitationStatus.DRAFT ? { status: InvitationStatus.SENT } : {}),
        ...(invitation.sentAt ? {} : { sentAt: now }),
      },
    }),
    // The first invitation that actually goes out freezes the event's names,
    // date and venue — they are printed on something a guest is now holding.
    // Keyed on sentAt rather than on the status, because setGuestBlocked()
    // writes SENT with no sentAt when it unblocks somebody: an invitation can
    // sit at SENT having never been delivered, and that must not count.
    ...(firstDelivery ? [lockEventDetailsOp(invitation.eventId, now)] : []),
  ]);
}

/**
 * Records a batch of invitations as sent — the admin's "copy all links", and
 * the host's send queue, both of which hand out many links in one gesture.
 *
 * `userId` null means the admin flow, whose action has already checked the
 * role; any other caller must own the event. Idempotent by construction: every
 * filter carries `sentAt: null`, so an invitation that already went out keeps
 * its original timestamp and is not counted again.
 *
 * Returns how many were newly recorded, so a caller can tell "I sent 40" from
 * "those 40 were already sent".
 */
export async function markInvitationsShared(
  eventId: string,
  guestIds: string[],
  userId: string | null,
): Promise<number> {
  // Never let an empty or undefined value reach a Prisma filter: Prisma DROPS
  // an `undefined` field rather than matching nothing, which on an updateMany
  // means a where clause that was meant to be narrow silently becomes
  // "every row". Explicitly refusing the empty case is what makes that
  // impossible here.
  const ids = [...new Set(guestIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return 0;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, ownerId: true, orderId: true },
  });
  if (!event || (userId !== null && event.ownerId !== userId)) throw new GuestError("Event not found");
  if (!event.orderId) throw new GuestError("Event is not activated yet");

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // Two statements rather than one, because updateMany cannot set a column
    // per row: a DRAFT becomes SENT, while an invitation left at SENT with no
    // sentAt by setGuestBlocked's unblock only needs the timestamp. The DRAFT
    // pass runs first, so the second no longer matches what it just wrote.
    const promoted = await tx.invitation.updateMany({
      where: { eventId, guestId: { in: ids }, sentAt: null, status: InvitationStatus.DRAFT },
      data: { status: InvitationStatus.SENT, sentAt: now },
    });
    const stamped = await tx.invitation.updateMany({
      where: { eventId, guestId: { in: ids }, sentAt: null },
      data: { sentAt: now },
    });

    const delivered = promoted.count + stamped.count;
    // Same rule as the single share: the first invitation that actually
    // reaches a guest freezes the event's names, date and venue.
    if (delivered > 0) await lockEventDetailsOp(eventId, now, tx);
    return delivered;
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
