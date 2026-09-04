import "server-only";
import { prisma } from "@/lib/db/client";
import { EventStatus, GuestManagementRequestStatus, OrderStatus, Role } from "@/generated/prisma/client";
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
 * `referenceCode` or any token either; in particular this is not a way to widen
 * capacity, which is snapshotted on the order and lives nowhere near here.
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

export async function listOrders() {
  return prisma.order.findMany({
    include: { user: true, plan: true, event: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
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
