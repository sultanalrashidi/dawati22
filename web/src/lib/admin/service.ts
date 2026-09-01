import "server-only";
import { prisma } from "@/lib/db/client";
import { EventStatus, GuestManagementRequestStatus, OrderStatus, Role } from "@/generated/prisma/client";
import type { InvitationTier } from "@/generated/prisma/enums";

export async function getDashboardMetrics() {
  const [events, invitations, accepted, checkedInAgg, orders, revenueAgg] = await Promise.all([
    prisma.event.count(),
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
      guests: { include: { invitation: true }, orderBy: { createdAt: "desc" } },
      guestManagementRequest: { select: { status: true } },
      gateStaffAssignments: { include: { gateStaff: { include: { user: true } } }, where: { revokedAt: null } },
    },
  });
}

export async function setEventStatus(eventId: string, status: EventStatus) {
  await prisma.event.update({ where: { id: eventId }, data: { status } });
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
