import "server-only";
import { prisma } from "@/lib/db/client";
import { CheckInResult, InvitationStatus, Role } from "@/generated/prisma/client";

export class CheckInAccessError extends Error {}

export type CheckInOutcome = {
  result: CheckInResult;
  guestName?: string;
  seatsAllowed?: number;
  seatsUsed?: number;
  seatsRemaining?: number;
};

/** Verifies the acting user may scan for this event; returns their GateStaff id (or null for an Admin). */
export async function assertGateAccess(userId: string, role: Role, eventId: string) {
  if (role === Role.ADMIN) return null;
  if (role !== Role.GATE_STAFF) throw new CheckInAccessError("Not authorized");

  const gateStaff = await prisma.gateStaff.findUnique({ where: { userId } });
  if (!gateStaff) throw new CheckInAccessError("Not authorized");

  const assignment = await prisma.gateStaffAssignment.findUnique({
    where: { gateStaffId_eventId: { gateStaffId: gateStaff.id, eventId } },
  });
  if (!assignment || assignment.revokedAt) throw new CheckInAccessError("Not assigned to this event");

  return gateStaff.id;
}

export async function listAssignedEvents(userId: string) {
  const gateStaff = await prisma.gateStaff.findUnique({
    where: { userId },
    include: {
      assignments: {
        where: { revokedAt: null },
        include: { event: { include: { guests: { select: { id: true, checkedInCount: true } } } } },
      },
    },
  });
  return gateStaff?.assignments.map((a) => a.event) ?? [];
}

export async function performCheckIn(
  qrToken: string,
  eventId: string,
  gateStaffId: string | null
): Promise<CheckInOutcome> {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { qrToken },
      include: { guest: true, event: true },
    });

    if (!invitation || invitation.eventId !== eventId) {
      return { result: CheckInResult.DENIED_INVALID };
    }
    const { guest, event } = invitation;

    const denyWith = async (result: CheckInResult) => {
      if (gateStaffId) {
        await tx.checkInLog.create({ data: { eventId, guestId: guest.id, gateStaffId, result } });
      }
      return { result, guestName: guest.nameAr };
    };

    if (guest.isBlocked || invitation.status === InvitationStatus.BLOCKED) {
      return denyWith(CheckInResult.DENIED_BLOCKED);
    }
    if (invitation.status === InvitationStatus.CANCELLED) {
      return denyWith(CheckInResult.DENIED_CANCELLED);
    }
    if (event.expiresAt && event.expiresAt < new Date()) {
      return denyWith(CheckInResult.DENIED_EXPIRED);
    }
    const confirmedStatuses = new Set<InvitationStatus>([
      InvitationStatus.ACCEPTED,
      InvitationStatus.VALID,
      InvitationStatus.PARTIALLY_USED,
      InvitationStatus.FULLY_USED,
    ]);
    if (event.rsvpRequired && !confirmedStatuses.has(invitation.status)) {
      return denyWith(CheckInResult.DENIED_UNCONFIRMED);
    }

    // Atomic, race-safe seat deduction: the WHERE guard means only one
    // concurrent scan can win the last seat — Postgres row-locks the UPDATE.
    const updated = await tx.guest.updateMany({
      where: { id: guest.id, checkedInCount: { lt: guest.allowedCount } },
      data: { checkedInCount: { increment: 1 } },
    });

    if (updated.count === 0) {
      await denyWith(CheckInResult.DENIED_FULL);
      return {
        result: CheckInResult.DENIED_FULL,
        guestName: guest.nameAr,
        seatsAllowed: guest.allowedCount,
        seatsUsed: guest.checkedInCount,
        seatsRemaining: 0,
      };
    }

    const freshGuest = await tx.guest.findUniqueOrThrow({ where: { id: guest.id } });
    const newInvitationStatus =
      freshGuest.checkedInCount >= freshGuest.allowedCount
        ? InvitationStatus.FULLY_USED
        : InvitationStatus.PARTIALLY_USED;

    await tx.invitation.update({ where: { id: invitation.id }, data: { status: newInvitationStatus } });

    if (gateStaffId) {
      await tx.checkInLog.create({
        data: {
          eventId,
          guestId: guest.id,
          gateStaffId,
          seatsBefore: freshGuest.checkedInCount - 1,
          seatsAfter: freshGuest.checkedInCount,
          result: CheckInResult.SUCCESS,
        },
      });
    }

    return {
      result: CheckInResult.SUCCESS,
      guestName: guest.nameAr,
      seatsAllowed: freshGuest.allowedCount,
      seatsUsed: freshGuest.checkedInCount,
      seatsRemaining: freshGuest.allowedCount - freshGuest.checkedInCount,
    };
  });
}
