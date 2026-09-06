import "server-only";
import { prisma } from "@/lib/db/client";
import { CheckInResult, InvitationStatus, Role, RsvpStatus } from "@/generated/prisma/client";
import { arabicIncludes, normalizeArabic } from "@/lib/arabic";

export class CheckInAccessError extends Error {}

export type CheckInOutcome = {
  result: CheckInResult;
  /** Present on any outcome that identified a guest — the door screen needs it to correct the count. */
  guestId?: string;
  guestName?: string;
  seatsAllowed?: number;
  seatsUsed?: number;
  seatsRemaining?: number;
  /** How many this scan let in, so the screen can open on the right number. */
  admittedNow?: number;
};

/** One guest as the door search shows her. */
export type DoorSearchResult = {
  id: string;
  nameAr: string;
  /** In full, deliberately: two women called أم فهد are told apart by nothing else. */
  phone: string | null;
  allowedCount: number;
  checkedInCount: number;
  rsvp: RsvpStatus | null;
  /** What she said when she replied, when she said anything. */
  partySize: number | null;
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

    // One scan lets the whole party in.
    //
    // It used to add exactly one, which meant a woman arriving with her three
    // daughters was four scans of the same code, in a queue, on a phone. And
    // `Rsvp.partySize` — the number she declared herself when she replied —
    // was read by nothing at all. So the scan admits what she declared, and
    // the screen then asks "how many?" for the times it is wrong.
    //
    // Where nothing was declared the answer is one, never "all her seats": a
    // guest with four seats who walks in alone must not have her invitation
    // closed behind her while the others are still parking.
    const declared = await declaredPartySize(tx, invitation.id);
    const wanted = Math.max(1, declared ?? 1);

    // Clamped inside the statement, so it is one atomic write: no read-then-
    // write window where a second scanner could push her past her seats, and
    // asking for more than remain simply admits what remains.
    const [admitted] = await tx.$queryRaw<{ checkedInCount: number }[]>`
      UPDATE "Guest"
         SET "checkedInCount" = LEAST("allowedCount", "checkedInCount" + ${wanted}),
             "updatedAt" = NOW()
       WHERE "id" = ${guest.id} AND "checkedInCount" < "allowedCount"
      RETURNING "checkedInCount"
    `;

    if (!admitted) {
      await denyWith(CheckInResult.DENIED_FULL);
      return {
        result: CheckInResult.DENIED_FULL,
        guestId: guest.id,
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
        seatsBefore: guest.checkedInCount,
        seatsAfter: freshGuest.checkedInCount,
        result: CheckInResult.SUCCESS,
      },
    });

    return {
      result: CheckInResult.SUCCESS,
      guestId: guest.id,
      guestName: guest.nameAr,
      seatsAllowed: freshGuest.allowedCount,
      seatsUsed: freshGuest.checkedInCount,
      seatsRemaining: freshGuest.allowedCount - freshGuest.checkedInCount,
      admittedNow: freshGuest.checkedInCount - guest.checkedInCount,
    };
  });
}

/** What the guest declared when she replied — the latest acceptance wins. */
async function declaredPartySize(
  tx: Pick<typeof prisma, "rsvp">,
  invitationId: string,
): Promise<number | null> {
  const reply = await tx.rsvp.findFirst({
    where: { invitationId, status: RsvpStatus.ACCEPTED },
    orderBy: { respondedAt: "desc" },
    select: { partySize: true },
  });
  return reply?.partySize ?? null;
}

/**
 * "How many actually walked in?" — the correction after a scan.
 *
 * An absolute count rather than a delta, because the door is exactly where a
 * request gets retried: a tap that lands twice must not admit two more women.
 * Clamped in the statement to her own seats, both ends, so the strictest rule
 * the customer asked for holds even against a hand-crafted request — nobody
 * gets in above what was bought for her.
 *
 * The invitation is left PARTIALLY_USED while seats remain, which is what
 * keeps it re-scannable for the two who are still parking.
 */
export async function setAdmittedCount(
  eventId: string,
  guestId: string,
  gateStaffId: string | null,
  seats: number,
): Promise<CheckInOutcome> {
  if (!Number.isInteger(seats) || seats < 0) return { result: CheckInResult.DENIED_INVALID };

  return prisma.$transaction(async (tx) => {
    const guest = await tx.guest.findUnique({
      where: { id: guestId },
      include: { invitation: true },
    });
    // The event check is the authorisation: a door session is granted for one
    // event, and a guest id from another wedding must not be reachable with it.
    if (!guest || guest.eventId !== eventId) return { result: CheckInResult.DENIED_INVALID };
    if (guest.isBlocked) return { result: CheckInResult.DENIED_BLOCKED, guestId, guestName: guest.nameAr };

    const before = guest.checkedInCount;
    const [row] = await tx.$queryRaw<{ checkedInCount: number }[]>`
      UPDATE "Guest"
         SET "checkedInCount" = LEAST("allowedCount", GREATEST(0, ${seats}::int)),
             "updatedAt" = NOW()
       WHERE "id" = ${guestId}
      RETURNING "checkedInCount"
    `;
    const after = row?.checkedInCount ?? before;

    if (guest.invitation) {
      await tx.invitation.update({
        where: { id: guest.invitation.id },
        data: {
          status:
            after >= guest.allowedCount
              ? InvitationStatus.FULLY_USED
              : after > 0
                ? InvitationStatus.PARTIALLY_USED
                : InvitationStatus.VALID,
        },
      });
    }

    // Logged like any other door event, including a correction downwards —
    // "she said four, three came" is exactly the thing worth being able to
    // read back the morning after.
    await tx.checkInLog.create({
      data: {
        eventId,
        guestId,
        gateStaffId,
        seatsBefore: before,
        seatsAfter: after,
        result: CheckInResult.SUCCESS,
      },
    });

    return {
      result: CheckInResult.SUCCESS,
      guestId,
      guestName: guest.nameAr,
      seatsAllowed: guest.allowedCount,
      seatsUsed: after,
      seatsRemaining: guest.allowedCount - after,
      admittedNow: after - before,
    };
  });
}

/** Digits only, with the Saudi country and trunk prefixes off, so `0501…`, `+966501…` and `501…` are one thing. */
function phoneKey(value: string): string {
  const digits = normalizeArabic(value).replace(/\D/g, "");
  return digits.replace(/^00/, "").replace(/^966/, "").replace(/^0+/, "");
}

const DOOR_SEARCH_LIMIT = 25;

/**
 * Finding a guest without her code.
 *
 * The door's only lookup was `findUnique({ qrToken })`, and the manual-entry
 * box next to the camera asked for a 43-character random string that no screen
 * in the product ever shows — a dead interface standing in for the one thing
 * that always happens: a phone that will not open, a screenshot that will not
 * scan, a guest who forwarded the message to her sister.
 *
 * Names are matched through the Arabic fold (see `@/lib/arabic`), so "ام فهد"
 * finds "أُمّ فهد"; numbers are matched on digits with the country and trunk
 * prefixes stripped, so how she typed it does not matter. The whole event's
 * list is read and filtered here rather than in SQL — a wedding is hundreds of
 * rows, not millions, and it buys matching that Postgres `ILIKE` cannot do.
 */
export async function searchGuestsAtDoor(eventId: string, query: string): Promise<DoorSearchResult[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: {
      id: true,
      nameAr: true,
      phone: true,
      allowedCount: true,
      checkedInCount: true,
      invitation: {
        select: {
          rsvps: {
            where: { status: RsvpStatus.ACCEPTED },
            orderBy: { respondedAt: "desc" },
            take: 1,
            select: { status: true, partySize: true },
          },
        },
      },
    },
    orderBy: { nameAr: "asc" },
  });

  const key = phoneKey(term);
  // A term of digits is a phone; anything else is a name. Two digits are not
  // enough of a number to be useful, and would match half the list.
  const byPhone = key.length >= 3;

  return guests
    .filter((guest) =>
      byPhone
        ? guest.phone !== null && phoneKey(guest.phone).includes(key)
        : arabicIncludes(guest.nameAr, term),
    )
    .slice(0, DOOR_SEARCH_LIMIT)
    .map((guest) => {
      const reply = guest.invitation?.rsvps[0] ?? null;
      return {
        id: guest.id,
        nameAr: guest.nameAr,
        phone: guest.phone,
        allowedCount: guest.allowedCount,
        checkedInCount: guest.checkedInCount,
        rsvp: reply?.status ?? null,
        partySize: reply?.partySize ?? null,
      };
    });
}
