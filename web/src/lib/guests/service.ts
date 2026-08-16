import "server-only";
import { prisma } from "@/lib/db/client";
import { generateSecureToken } from "@/lib/security/tokens";
import { InvitationStatus } from "@/generated/prisma/client";

export class GuestError extends Error {}

async function assertOwnedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { order: { include: { plan: true } }, _count: { select: { guests: true } } },
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
  if (event._count.guests >= event.order.plan.invitationCount) {
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
          status: InvitationStatus.SENT,
          linkToken: generateSecureToken(),
          qrToken: generateSecureToken(),
          sentAt: new Date(),
        },
      },
    },
    include: { invitation: true },
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
