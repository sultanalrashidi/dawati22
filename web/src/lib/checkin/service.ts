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
  // An event sold without a scannable pass has no door flow at all, so it must
  // not appear on the scanner — a staff member picking it would only ever see
  // denials, with nothing on screen explaining why.
  return gateStaff?.assignments.map((a) => a.event).filter((event) => event.hasQr) ?? [];
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
      // A code from another wedding, or one that does not exist. There is no
      // guest to point at — which is what `guestId` being nullable is for —
      // but the door still saw a scan, and a record with a hole in it beats no
      // record of the thing that actually happened.
      await tx.checkInLog.create({
        data: { eventId, guestId: null, gateStaffId, result: CheckInResult.DENIED_INVALID },
      });
      return { result: CheckInResult.DENIED_INVALID };
    }
    const { guest, event } = invitation;

    // Every outcome is logged, refusals included — a door with no record of
    // who was turned away is a door nobody can answer questions about the
    // morning after. `gateStaffId` is null for the shared-PIN door and for
    // support scanning from the admin side; it used to be NOT NULL, which is
    // the only reason the PIN door wrote nothing at all.
    const denyWith = async (result: CheckInResult) => {
      await tx.checkInLog.create({ data: { eventId, guestId: guest.id, gateStaffId, result } });
      return { result, guestName: guest.nameAr };
    };

    // The tier check comes first: this event was not sold with a door pass, so
    // there is no code that should ever open it. Tokens are still minted for
    // every guest — that keeps a later upgrade to a single boolean flip — which
    // is exactly why the refusal has to live here and not in token issuance.
    if (!event.hasQr) {
      return denyWith(CheckInResult.DENIED_INVALID);
    }
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

    return {
      result: CheckInResult.SUCCESS,
      guestName: guest.nameAr,
      seatsAllowed: freshGuest.allowedCount,
      seatsUsed: freshGuest.checkedInCount,
      seatsRemaining: freshGuest.allowedCount - freshGuest.checkedInCount,
    };
  });
}
