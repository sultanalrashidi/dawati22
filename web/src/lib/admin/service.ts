import "server-only";
import { prisma } from "@/lib/db/client";
import { eventCapacity, capacityBreakdown } from "@/lib/events/capacity";
import { writeAuditLog, listAuditLog, type AuditActor } from "@/lib/audit/service";
import { normalizeArabic } from "@/lib/arabic";
import { normalizePhone, DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/security/phone";
import { riyadhDateTimeLocalToDate } from "@/lib/dates";
import { EventStatus, GuestManagementRequestStatus, OrderStatus, Role, type Prisma } from "@/generated/prisma/client";
import type { InvitationTier } from "@/generated/prisma/enums";

export async function getDashboardMetrics() {
  const [events, invitations, accepted, checkedInAgg, orders, revenueAgg] = await Promise.all([
    // Real events, not drafts: this number sits next to paid orders and
    // revenue on the dashboard, and counting abandoned free drafts in it would
    // quietly inflate the one metric that says how the business is doing.
    prisma.event.count({ where: { orderId: { not: null } } }),
    prisma.invitation.count({ where: { status: { not: "DRAFT" } } }),
    prisma.invitation.count({
      where: { status: { in: ["ACCEPTED", "VALID", "PARTIALLY_USED", "FULLY_USED"] } },
    }),
    prisma.guest.aggregate({ _sum: { checkedInCount: true } }),
    prisma.order.count({ where: { status: OrderStatus.PAID } }),
    prisma.order.aggregate({ _sum: { amount: true }, where: { status: OrderStatus.PAID } }),
  ]);

  return {
    events,
    invitationsSent: invitations,
    rsvpAccepted: accepted,
    totalCheckedIn: checkedInAgg._sum.checkedInCount ?? 0,
    paidOrders: orders,
    revenue: Number(revenueAgg._sum.amount ?? 0),
  };
}

export async function listUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
}

export async function setUserBlocked(userId: string, blocked: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { isBlocked: blocked } });
}

export async function listEventsAdmin() {
  return prisma.event.findMany({
    // Activated events only. This is the operational list — real weddings with
    // a paying customer behind them — and every row it renders reads the owner
    // and the order. Unpaid drafts, most of which will be anonymous and
    // abandoned, get their own screen rather than burying the real work.
    where: { orderId: { not: null } },
    include: {
      owner: true,
      theme: true,
      order: { include: { plan: true } },
      guests: { select: { id: true, checkedInCount: true } },
      // Whether the team has sent this event's invitations yet — only
      // meaningful when the customer picked team-managed guests.
      guestManagementRequest: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/**
 * Marks a team-managed event's invitations as sent (or walks that back).
 *
 * The request row is written lazily, HERE, rather than when the customer
 * creates the event: the badge in the events list derives "pending" from the
 * event's own `guestManagementMode`, so a missing row already reads as
 * pending and event creation never gained a step that could fail. The row
 * exists to remember the one thing the mode cannot: that the team finished.
 */
export async function setGuestManagementDone(eventId: string, adminId: string, done: boolean) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event) throw new Error("Event not found");
  // An unclaimed draft has nobody to record as the requester, and there is
  // nothing to hand over to the team before it is paid for anyway.
  if (!event.ownerId) throw new Error("Event has no owner yet");

  const resolution = done
    ? { status: GuestManagementRequestStatus.COMPLETED, resolvedById: adminId, resolvedAt: new Date() }
    : { status: GuestManagementRequestStatus.PENDING, resolvedById: null, resolvedAt: null };

  await prisma.guestManagementRequest.upsert({
    where: { eventId },
    update: resolution,
    create: { eventId, requestedById: event.ownerId, ...resolution },
  });
}

export async function getEventAdmin(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      owner: true,
      theme: true,
      order: { include: { plan: true } },
      couples: { orderBy: { sortOrder: "asc" } },
      guests: { include: { invitation: true }, orderBy: { createdAt: "desc" } },
      guestManagementRequest: { select: { status: true } },
      gateStaffAssignments: { include: { gateStaff: { include: { user: true } } }, where: { revokedAt: null } },
    },
  });
}

export async function setEventStatus(eventId: string, status: EventStatus) {
  await prisma.event.update({ where: { id: eventId }, data: { status } });
}

/**
 * Support reopening (or re-freezing) a customer's own edit form.
 *
 * It touches ONE column. Not `Invitation.sentAt`, not any invitation status —
 * reopening is about the form, not about un-sending, and the dashboard's "sent"
 * count must keep telling the truth. Not `orderId`, `status`, `hasQr`,
 * `referenceCode` or any token either; and not capacity, which is the paid
 * snapshot on the order plus `Event.extraInvitationCount` — the latter has its
 * own audited writer below (`grantExtraInvitations`), and nothing else in the
 * admin may move it.
 *
 * Support's own writer has always ignored the lock and still does — this only
 * decides whether the CUSTOMER's screen will let her save.
 */
/** Invitations of this event that have actually gone out. */
export async function countSentInvitations(eventId: string) {
  return prisma.invitation.count({ where: { eventId, sentAt: { not: null } } });
}

export async function setEventDetailsLock(eventId: string, locked: boolean) {
  if (!locked) {
    // updateMany, not update: a stale id from a double-click must be a no-op,
    // not a P2025 surfacing as a 500 on an admin button.
    await prisma.event.updateMany({ where: { id: eventId }, data: { detailsLockedAt: null } });
    return;
  }
  // Re-locking restores the moment the data actually froze rather than "now" —
  // COALESCE(MIN(sentAt), now()), the same expression the backfill used. That
  // keeps reopen/re-lock idempotent instead of ratcheting the timestamp
  // forward every time support touches it, and keeps the date the customer's
  // dashboard prints true.
  const first = await prisma.invitation.aggregate({
    where: { eventId, sentAt: { not: null } },
    _min: { sentAt: true },
  });
  await prisma.event.updateMany({
    where: { id: eventId },
    data: { detailsLockedAt: first._min.sentAt ?? new Date() },
  });
}

/**
 * Finding one order, when "دفعت وما وصلني شي" arrives on WhatsApp.
 *
 * The screen was four columns and no search — a name, an amount, a provider
 * and a status — so the message could not be matched to a row at all, and it
 * could not even be told whether the order was from today. These are the four
 * things a customer actually has to hand: her number, her event's reference
 * code, the payment reference off her bank app, and the day.
 *
 * One box, because she will paste whichever of them she has and the screen
 * should not ask her which kind it is. What the term is decides how it is
 * matched, and each is matched EXACTLY against a column that is already
 * uniquely indexed — never a LIKE:
 *
 *  - a phone: folded through the Arabic digits first (`normalizePhone` uses
 *    `\D`, which is ASCII-only, so "٠٥٠…" normalizes to null without this),
 *    then expanded to the few forms it could have been stored as.
 *  - a reference code: six characters from an alphabet with no 0/O/1/I/L,
 *    stored uppercase — so uppercased, not lowercased.
 *  - a Moyasar payment reference: passed through untouched. It is a
 *    case-sensitive id from someone else's system, and folding it would be
 *    corrupting it. (`idempotencyKey` looks searchable and is not: it is ours,
 *    and the customer has never seen it.)
 */
export interface OrderSearch {
  /** Phone, reference code or payment reference — whichever she pasted. */
  term?: string;
  /** A single Riyadh day, as `YYYY-MM-DD`. */
  day?: string;
}

/**
 * Every form the same number could have been stored as. Exact matches, never a
 * prefix — the column is uniquely indexed and a LIKE here would be the one
 * genuinely expensive mistake available.
 *
 * The country is NOT assumed. Fabricating `+966` from a bare national number
 * would hand support somebody else's customer: the sign-up picker offers
 * eighteen countries, and `5xxxxxxxx` is a valid mobile in Saudi, the Emirates
 * and Palestine alike. So a number with no dial code is expanded against every
 * country whose own pattern it matches, and all of those are searched.
 */
function phoneCandidates(term: string): string[] {
  const digits = normalizeArabic(term).replace(/\D/g, "");
  if (digits.length < 7) return [];

  const forms = new Set<string>([digits, `+${digits}`]);

  // Already carrying a country code, in one of the shapes people paste.
  const international = normalizePhone(digits, DEFAULT_PHONE_COUNTRY);
  if (international) forms.add(international);

  // Bare national: let each country claim it, or none.
  const national = digits.replace(/^00/, "").replace(/^0+/, "");
  for (const country of PHONE_COUNTRIES) {
    if (country.national.test(national)) forms.add(`+${country.dialCode}${national}`);
  }

  return [...forms].filter(Boolean);
}

/** The half-open Riyadh day, so "the 12th" means her 12th and not the server's. */
function riyadhDayRange(day: string): { gte: Date; lt: Date } | null {
  const start = riyadhDateTimeLocalToDate(`${day}T00:00`);
  if (!start) return null;
  return { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export async function listOrders(search: OrderSearch = {}) {
  const term = (search.term ?? "").trim();
  const day = (search.day ?? "").trim();

  const or: Prisma.OrderWhereInput[] = [];
  if (term) {
    const phones = phoneCandidates(term);
    if (phones.length > 0) or.push({ user: { phone: { in: phones } } });

    const code = normalizeArabic(term).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length >= 4) or.push({ event: { referenceCode: code } });

    // Untouched on purpose — Moyasar's id, not ours to fold.
    or.push({ providerRef: term });
  }

  const range = day ? riyadhDayRange(day) : null;

  const where: Prisma.OrderWhereInput = {
    ...(or.length > 0 ? { OR: or } : {}),
    ...(range ? { createdAt: range } : {}),
  };

  const PAGE = 200;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: true, plan: true, event: { select: { id: true, name: true, referenceCode: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE,
    }),
    // The real total, because printing the page size as a count would tell
    // support "12 orders" when the answer is 212 and the one she wants is
    // older than the cut.
    prisma.order.count({ where }),
  ]);
  return { orders, total, shown: orders.length, truncated: total > orders.length };
}

/**
 * The retired fixed packages, newest pricing first. Read-only: they are kept so
 * an old order can still say what it bought, and editing one would be editing
 * history — the count a customer paid for now lives on their order.
 */
export async function listPlans() {
  return prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
}

/** Bounds no sane price list would leave — typo guards, not business rules. */
const MAX_UNIT_PRICE_SAR = 100;
const MIN_UNIT_PRICE_SAR = 0.25;

export async function updatePricingRate(tier: InvitationTier, unitPriceSar: number) {
  // Validate the value that will actually be STORED, not the one submitted:
  // the column is Decimal(10,2), so 0.004 passes a bare `> 0` check and then
  // rounds to 0.00 — a free price list, with every order after it worth zero.
  const stored = Number(unitPriceSar.toFixed(2));
  if (!Number.isFinite(stored) || stored < MIN_UNIT_PRICE_SAR || stored > MAX_UNIT_PRICE_SAR) {
    throw new Error("Invalid unit price");
  }
  // Upsert, not update: these two rows ARE the public price list, and the page
  // renders nothing sellable without both. If one is ever missing, this is the
  // only screen that can put it back — `update` would fail and leave the shop
  // shut with no way in.
  await prisma.pricingRate.upsert({
    where: { tier },
    update: { unitPrice: stored.toFixed(2) },
    // Only new orders are affected either way: every order copies the rate onto
    // itself at purchase, so nothing already sold is re-priced by this.
    create: { tier, unitPrice: stored.toFixed(2) },
  });
}

export async function listGateStaff() {
  return prisma.gateStaff.findMany({
    include: {
      user: true,
      assignments: { where: { revokedAt: null }, include: { event: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function assertIsAdmin(role: Role) {
  if (role !== Role.ADMIN) throw new Error("Not authorized");
}

/**
 * The most invitations the owner can hand out on one event.
 *
 * A typo guard, not a business rule — it matches the top of the price list, so
 * a slipped keypress cannot turn 50 into 5000. The same shape as the price
 * bounds above.
 */
export const MAX_EXTRA_INVITATIONS = 800;

export class AdminGrantError extends Error {}

/**
 * Invitations granted by hand, on top of what the order bought.
 *
 * The owner's decision, never a sale: `Event.orderId` is @unique, so an event
 * physically cannot hold a second order, and `Order.invitationCount` is the
 * figure Moyasar is reconciled against — editing it would make the order lie
 * about the amount that was charged. So the grant is its own column, and the
 * order stays a truthful record of the money.
 *
 * Four refusals, each for something that actually happens:
 *
 * 1. A DRAFT gets nothing. `orderTerms` returns zero capacity for an event
 *    with no order precisely so an unpaid invitation cannot take a guest, and
 *    a grant that survived activation would re-open exactly that: pre-grant
 *    +50, let her pay the 25 minimum, and she holds 75 while her receipt, her
 *    order and Moyasar all say 25.
 *
 * 2. It cannot be set below the guests already added. Reducing a grant
 *    revokes nothing — the links still work, the entry passes still scan, and
 *    the door never consults capacity at all — so an unfloored reduction
 *    leaves a silent over-capacity state that shows up only as a broken
 *    dashboard. Refusing is the honest answer: remove the guests first.
 *
 * 3. Bounds, both ends.
 *
 * 4. Under the same `FOR UPDATE` lock the guest writers take, so a grant and
 *    a three-hundred-name paste cannot pass each other.
 *
 * The set is absolute, not a delta: an admin form that gets double-submitted
 * must not grant twice. But absolute plus last-write-wins is how one admin
 * silently erases another's grant — his tab rendered 0, someone granted 200 in
 * the meantime, he submits 50 and 150 invitations vanish with the audit row
 * reading as a deliberate reduction. So the write is a compare-and-set against
 * the figure the panel actually displayed, and a stale one is refused rather
 * than applied.
 */
export async function grantExtraInvitations(
  eventId: string,
  actor: AuditActor,
  extraInvitationCount: number,
  reason: string,
  /** What the panel was showing when it was submitted — see the compare-and-set below. */
  expectedBefore: number,
): Promise<{ paid: number; granted: number; total: number; occupied: number }> {
  if (!Number.isInteger(extraInvitationCount) || extraInvitationCount < 0) {
    throw new AdminGrantError("invalid_count");
  }
  if (extraInvitationCount > MAX_EXTRA_INVITATIONS) throw new AdminGrantError("too_many");
  if (reason.trim().length < 3) throw new AdminGrantError("reason_required");

  return prisma.$transaction(async (tx) => {
    // Same row, same lock, same order as `lockEventForCapacity` in the guest
    // service — that is what makes the two writers see each other.
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        orderId: true,
        extraInvitationCount: true,
        order: { select: { invitationCount: true, tier: true, amount: true, currency: true, plan: { select: { name: true, nameAr: true, invitationCount: true } } } },
      },
    });
    if (!event) throw new AdminGrantError("not_found");
    if (!event.orderId) throw new AdminGrantError("not_activated");

    const before = event.extraInvitationCount;
    const capacityBefore = eventCapacity(event);
    const paid = capacityBefore - Math.max(0, before);

    const occupied = await tx.guest.count({
      where: { eventId, NOT: { invitation: { is: { status: "DECLINED" } } } },
    });
    if (paid + extraInvitationCount < occupied) throw new AdminGrantError("below_current_guests");

    // Compare-and-set. The lock serialises the two writers; this is what makes
    // the second one NOTICE that the ground moved under it.
    const applied = await tx.event.updateMany({
      where: { id: eventId, extraInvitationCount: expectedBefore },
      data: { extraInvitationCount },
    });
    if (applied.count === 0) throw new AdminGrantError("stale");

    await writeAuditLog(tx, {
      actor,
      action: "event.extra_invitations.granted",
      entityType: "Event",
      entityId: eventId,
      meta: {
        before,
        after: extraInvitationCount,
        delta: extraInvitationCount - before,
        reason: reason.trim(),
        // Proof, in the row itself, that the paid snapshot was not touched.
        orderId: event.orderId,
        orderInvitationCount: event.order?.invitationCount ?? null,
        capacityBefore,
        capacityAfter: paid + extraInvitationCount,
        occupiedSlots: occupied,
        eventName: event.name,
        eventOwnerId: event.ownerId,
      },
    });

    return { paid, granted: extraInvitationCount, total: paid + extraInvitationCount, occupied };
  },
  // Budgeted longer than the writer it queues behind. `addGuestsBulk` holds
  // this exact row lock for up to 20 seconds because a 500-name paste has to
  // survive a cold connection; on Prisma's default 5s the grant would abort
  // with a raw P2028 while merely WAITING for that lock — and the moment
  // support tops an event up is precisely the moment her import just ran out
  // of room and she is retrying it.
  { timeout: 25_000, maxWait: 20_000 });
}

/**
 * Everything the grant panel needs, including the history.
 *
 * The history matters as much as the control. `AuditLog` had no reader
 * anywhere in the product, so writing a row and stopping would have left the
 * grant exactly as invisible as it is today, just with a row behind it — the
 * owner still unable to answer "which events did I top up, and why".
 */
export async function getGrantContext(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      orderId: true,
      extraInvitationCount: true,
      hasQr: true,
      order: { select: { invitationCount: true, tier: true, amount: true, currency: true, plan: { select: { name: true, nameAr: true, invitationCount: true } } } },
    },
  });
  if (!event) return null;

  const [occupied, log] = await Promise.all([
    prisma.guest.count({
      where: { eventId, NOT: { invitation: { is: { status: "DECLINED" } } } },
    }),
    listAuditLog("Event", eventId),
  ]);

  const { paid, granted } = capacityBreakdown(event);
  return {
    paid,
    granted,
    occupied,
    hasQr: event.hasQr,
    history: log
      .filter((row) => row.action === "event.extra_invitations.granted")
      .map((row) => {
        const meta = (row.meta ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          createdAt: row.createdAt,
          before: Number(meta.before ?? 0),
          after: Number(meta.after ?? 0),
          reason: typeof meta.reason === "string" ? meta.reason : "",
          // From `meta`, not the relation: `AuditLog.actor` is optional with no
          // `onDelete`, so removing an employee's account would otherwise erase
          // who issued every grant they ever made.
          actorName: typeof meta.actorName === "string" ? meta.actorName : "—",
        };
      }),
  };
}
