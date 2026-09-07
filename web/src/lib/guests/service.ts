import "server-only";
import { prisma } from "@/lib/db/client";
import { generateSecureToken } from "@/lib/security/tokens";
import { InvitationStatus, type Prisma } from "@/generated/prisma/client";
import { lockEventDetailsOp } from "@/lib/events/lock";
import { MAX_SEATS, type ParsedRow } from "@/lib/guests/import-parse";
import { normalizeArabic } from "@/lib/arabic";
import { eventCapacity } from "@/lib/events/capacity";
import { normalizePhone, DEFAULT_PHONE_COUNTRY } from "@/lib/security/phone";

export class GuestError extends Error {}

async function assertOwnedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { order: { include: { plan: true } } },
  });
  if (!event || event.ownerId !== userId) throw new GuestError("Event not found");
  // THE PAYWALL. This function guards the only place in the product that mints
  // a linkToken or a qrToken, so "no guest ⇒ no shareable invitation URL
  // exists" is what actually keeps an unpaid invitation unshareable — not the
  // schema. It used to be enforced by `Event.orderId` being NOT NULL; that
  // column is now nullable so a draft can exist before payment, and this is
  // where the same guarantee moved to. Capacity below would refuse a draft
  // anyway (an absent order reads as zero invitations), but only by accident
  // of arithmetic — this says it on purpose, and in the customer's terms.
  if (!event.orderId) throw new GuestError("Event is not activated yet");
  return event;
}

export async function addGuest(
  eventId: string,
  userId: string,
  input: { nameAr: string; phone?: string; allowedCount: number }
) {
  const event = await assertOwnedEvent(eventId, userId);
  if (input.allowedCount < 1 || input.allowedCount > MAX_SEATS) {
    throw new GuestError("Invalid seat count");
  }
  return prisma.$transaction(async (tx) => {
    // The check and the write on the same queue as the bulk import. Without
    // the row lock the two paths simply do not see each other, and pasting a
    // list on a laptop while adding one guest on a phone could take the event
    // over the count.
    //
    // Capacity is what she PAID FOR plus what the owner GRANTED, and the
    // granted half comes from the locked read so a grant changing underneath
    // cannot be missed.
    const { extraInvitationCount } = await lockEventForCapacity(tx, eventId);
    const capacity = eventCapacity({ ...event, extraInvitationCount });
    if ((await occupiedSlotCount(tx, eventId)) >= capacity) {
      throw new GuestError("Guest limit reached for this event's plan");
    }

    // A repeated name needs a number. The paste path has warned about
    // duplicates for a while; adding one guest at a time checked nothing at
    // all, which is the easier way to end up with two women called «أم فهد»
    // and a door that cannot say which is which. Inside the lock, so the two
    // paths cannot each add the second «أم فهد» at the same moment.
    if (!input.phone) {
      const nameKey = normalizeArabic(input.nameAr);
      const takenNames = new Set(
        (await tx.guest.findMany({ where: { eventId }, select: { nameAr: true } })).map((guest) =>
          normalizeArabic(guest.nameAr),
        ),
      );
      if (takenNames.has(nameKey)) throw new GuestError("Name needs a phone");
    }

    return tx.guest.create({
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
  });
}

/**
 * Serializes every writer that has to respect the capacity onto one row, and
 * hands back the half of that capacity which can change.
 *
 * `FOR UPDATE` on the Event, not on the Guest rows, because the thing being
 * protected is a COUNT — the rows a competing transaction is about to insert
 * are not there to be locked. Both `addGuest` and `addGuestsBulk` take it
 * before counting, so the second one waits for the first to commit and then
 * counts what the first actually wrote.
 *
 * It RETURNS `extraInvitationCount` for a reason. Capacity used to be read
 * before the transaction opened, which was safe only while it came from the
 * order snapshot — a column that never changes. The hand-granted half does
 * change, and reading it outside the lock puts a window between the read and
 * the count: the owner reduces a grant he issued by mistake, and an import
 * already in flight commits against a capacity that no longer exists. So the
 * mutable half is read here, under the lock, and nowhere else.
 */
async function lockEventForCapacity(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<{ extraInvitationCount: number }> {
  const [row] = await tx.$queryRaw<{ extraInvitationCount: number }[]>`
    SELECT "extraInvitationCount" FROM "Event" WHERE id = ${eventId} FOR UPDATE
  `;
  return { extraInvitationCount: row?.extraInvitationCount ?? 0 };
}

/**
 * Guests occupying a slot right now.
 *
 * A DECLINED guest gives her slot back — she said no, so the host may invite
 * someone else in her place — which is also why removing a declined guest must
 * never free a slot a second time: her slot was already given back the moment
 * she declined, not when her row disappears. Counting everyone EXCEPT the
 * declined is what makes that true, rather than counting the declined and
 * subtracting them.
 */
async function occupiedSlotCount(tx: Prisma.TransactionClient, eventId: string) {
  return tx.guest.count({
    where: { eventId, NOT: { invitation: { is: { status: InvitationStatus.DECLINED } } } },
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
      // `status: SENT` and not merely `sentAt: null`: BLOCKED is also a status
      // with no sentAt, and recording a blocked guest as delivered would both
      // lie in the dashboard's count and freeze the event's details on the
      // strength of an invitation nobody can open.
      where: { eventId, guestId: { in: ids }, sentAt: null, status: InvitationStatus.SENT },
      data: { sentAt: now },
    });

    const delivered = promoted.count + stamped.count;
    // Same rule as the single share: the first invitation that actually
    // reaches a guest freezes the event's names, date and venue.
    if (delivered > 0) await lockEventDetailsOp(eventId, now, tx);
    return delivered;
  });
}

/**
 * Writes a whole pasted list in one go.
 *
 * All-or-nothing on capacity. A partial import of a 300-name list would leave
 * her guessing which of the three hundred made it, and the seats she is short
 * by is a number she can act on — buy more, or cut the list — where "somewhere
 * between 0 and 300 guests were added" is not.
 *
 * `importBatchId` is what makes the confirm idempotent: a phone that loses the
 * response and retries finds its own batch already present and is told so,
 * rather than adding everyone twice. It is also the undo.
 */
export async function addGuestsBulk(
  eventId: string,
  userId: string,
  rows: Array<Pick<ParsedRow, "nameAr" | "phone" | "allowedCount">>,
  batchId: string,
): Promise<{ created: number; alreadyApplied: boolean; capacityShortBy: number }> {
  const event = await assertOwnedEvent(eventId, userId);
  if (!batchId) throw new GuestError("Missing batch id");
  if (rows.length === 0) throw new GuestError("Nothing to import");

  // The client array is untrusted input — it is whatever the browser posted,
  // not whatever the review table displayed. Every field is re-checked here,
  // and the phone is re-normalized rather than stored as the string it sent.
  const clean = rows.map((row) => ({
    nameAr: row.nameAr.trim(),
    phone: row.phone ? normalizePhone(row.phone, DEFAULT_PHONE_COUNTRY) : null,
    allowedCount: Number.isInteger(row.allowedCount) ? row.allowedCount : 1,
  }));
  if (clean.some((r) => r.nameAr.length < 2)) throw new GuestError("A guest has no name");
  // The posted array is not what the review table showed — it is whatever the
  // browser sent — so the duplicate-name rule is re-applied here rather than
  // trusted from the parse. Within the paste itself; against the guests she
  // already has is checked inside the transaction, where the lock is held.
  const seenNames = new Set<string>();
  for (const row of clean) {
    const key = normalizeArabic(row.nameAr);
    if (!row.phone && seenNames.has(key)) throw new GuestError("Name needs a phone");
    seenNames.add(key);
  }
  if (clean.some((r) => r.allowedCount < 1 || r.allowedCount > MAX_SEATS)) {
    throw new GuestError("Invalid seat count");
  }

  return prisma.$transaction(async (tx) => {
    // Already applied? Answered inside the lock, so a double submit that
    // arrives while the first is still committing waits and then sees it.
    // The lock also yields the granted half of the capacity — see its comment.
    const { extraInvitationCount } = await lockEventForCapacity(tx, eventId);
    const capacity = eventCapacity({ ...event, extraInvitationCount });
    const existingBatch = await tx.guest.count({ where: { eventId, importBatchId: batchId } });
    if (existingBatch > 0) {
      return { created: 0, alreadyApplied: true, capacityShortBy: 0 };
    }

    const takenNames = new Set(
      (await tx.guest.findMany({ where: { eventId }, select: { nameAr: true } })).map((guest) =>
        normalizeArabic(guest.nameAr),
      ),
    );
    if (clean.some((row) => !row.phone && takenNames.has(normalizeArabic(row.nameAr)))) {
      throw new GuestError("Name needs a phone");
    }

    const occupied = await occupiedSlotCount(tx, eventId);
    const shortBy = occupied + clean.length - capacity;
    if (shortBy > 0) {
      // Not an exception: "you are 12 over" is something she can act on, and
      // throwing would lose the number.
      return { created: 0, alreadyApplied: false, capacityShortBy: shortBy };
    }

    // TWO statements, not two per guest. A nested create per row is three
    // round trips each (guest, invitation, read-back), and an interactive
    // transaction serializes every one of them onto a single connection: at
    // the 800 invitations this product actually sells that is ~2,400 sequential
    // round trips inside a transaction whose default budget is five seconds.
    // It would fail exactly on the big lists this feature exists for, roll
    // back everything, and hold the capacity lock the whole time.
    const created = await tx.guest.createManyAndReturn({
      data: clean.map((row) => ({
        eventId,
        importBatchId: batchId,
        nameAr: row.nameAr,
        phone: row.phone,
        allowedCount: row.allowedCount,
      })),
      select: { id: true },
    });
    // Invitation.guestId is a plain unique FK, so the second insert only needs
    // the ids the first returned. This is still the only place in the product
    // that mints a linkToken, and it is still behind assertOwnedEvent.
    await tx.invitation.createMany({
      data: created.map((guest) => ({
        guestId: guest.id,
        eventId,
        // DRAFT, exactly as addGuest: importing a list is not sending it.
        status: InvitationStatus.DRAFT,
        linkToken: generateSecureToken(),
        qrToken: generateSecureToken(),
      })),
    });

    return { created: created.length, alreadyApplied: false, capacityShortBy: 0 };
  },
  // Belt and braces on top of the two-statement rewrite: a cold connection or
  // a slow link must not turn a 500-name list into a total rollback.
  { timeout: 20_000, maxWait: 5_000 });
}

/**
 * Undoes one import — but only the part of it that is still undoable.
 *
 * Stricter than `deleteGuest` on purpose. A batch of three hundred is one
 * gesture to add and must be one gesture to remove, and that is exactly why it
 * must not be able to remove a guest whose invitation has gone out, who has
 * replied, or who has walked through the door: those are people, not rows, and
 * one mis-tap should not be able to erase what they said.
 *
 * Every condition is re-asserted in the DELETE itself rather than checked
 * against a snapshot — a guest who opens her link between a SELECT and a
 * DELETE would otherwise be deleted anyway, taking her reply with her.
 */
export async function undoImport(
  eventId: string,
  userId: string,
  batchId: string,
): Promise<{ deleted: number; kept: number }> {
  await assertOwnedEvent(eventId, userId);
  if (!batchId) throw new GuestError("Missing batch id");

  return prisma.$transaction(async (tx) => {
    const before = await tx.guest.count({ where: { eventId, importBatchId: batchId } });
    const deleted = await tx.guest.deleteMany({
      where: {
        eventId,
        importBatchId: batchId,
        checkedInCount: 0,
        invitation: {
          is: {
            sentAt: null,
            status: InvitationStatus.DRAFT,
            rsvps: { none: {} },
          },
        },
      },
    });
    return { deleted: deleted.count, kept: before - deleted.count };
  });
}

/**
 * Un-records a send — the escape hatch for a mis-tap on the send queue.
 *
 * Deliberately does NOT touch `Event.detailsLockedAt`. Unmarking says "I did
 * not actually send this one", not "nothing has ever gone out", and the lock
 * answers the second question. Something else in the batch may well have
 * reached a guest, and un-freezing her names on the strength of one correction
 * would be exactly the wrong direction to be wrong in.
 *
 * Only an invitation still at SENT is unmarked: once a guest has opened it
 * (VIEWED) or replied, the send is a fact, not a claim.
 */
export async function unmarkInvitationShared(guestId: string, userId: string) {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { eventId: true, event: { select: { ownerId: true } }, invitation: { select: { id: true } } },
  });
  if (!guest || guest.event.ownerId !== userId) throw new GuestError("Guest not found");
  // Never let an optional id reach a Prisma filter. `Guest.invitation` is
  // optional in the schema, and Prisma DROPS an undefined field rather than
  // matching nothing — `where: { id: undefined, status: SENT }` would be
  // "every SENT invitation in the database".
  const invitation = guest.invitation;
  if (!invitation) throw new GuestError("Guest has no invitation");

  await prisma.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: { id: invitation.id, eventId: guest.eventId, status: InvitationStatus.SENT },
      data: { status: InvitationStatus.DRAFT, sentAt: null },
    });

    // Release the lock ONLY when this correction leaves nothing at all sent.
    //
    // The rule is unchanged — unmarking says "I did not send that one", not
    // "nothing has ever gone out" — but if she mis-taps the very FIRST guest
    // and undoes it a second later, then nothing HAS gone out, and leaving her
    // details frozen forever on the strength of a tap she took back is the
    // wrong answer. Asked of the database rather than assumed, so an
    // invitation somebody else's tap sent keeps the event locked.
    const stillSent = await tx.invitation.count({
      where: { eventId: guest.eventId, sentAt: { not: null } },
    });
    if (stillSent === 0) {
      await tx.event.updateMany({
        where: { id: guest.eventId },
        data: { detailsLockedAt: null },
      });
    }
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

/** Her current guests, in the shape the paste parser compares against. */
export async function listGuestKeysForEvent(
  eventId: string,
  userId: string,
): Promise<{ nameAr: string; phone: string | null }[]> {
  await assertOwnedEvent(eventId, userId);
  return prisma.guest.findMany({ where: { eventId }, select: { nameAr: true, phone: true } });
}
