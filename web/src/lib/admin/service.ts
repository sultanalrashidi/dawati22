import "server-only";
import { prisma } from "@/lib/db/client";
import { EventStatus, OrderStatus, Role } from "@/generated/prisma/client";

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
    },
    orderBy: { createdAt: "desc" },
    take: 200,
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

export async function listPlans() {
  return prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
}

export interface PlanInput {
  name: string;
  nameAr: string;
  invitationCount: number;
  price: number;
  sortOrder: number;
}

export async function createPlan(input: PlanInput) {
  return prisma.plan.create({ data: input });
}

export async function updatePlan(planId: string, input: PlanInput) {
  return prisma.plan.update({ where: { id: planId }, data: input });
}

export async function setPlanStatus(planId: string, status: "ACTIVE" | "HIDDEN" | "ARCHIVED") {
  await prisma.plan.update({ where: { id: planId }, data: { status } });
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
