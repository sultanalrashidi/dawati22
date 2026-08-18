import "server-only";
import { prisma } from "@/lib/db/client";
import { EventGuestManagementMode, EventType, OrderStatus } from "@/generated/prisma/client";

export class EventError extends Error {}

export async function listOwnedEvents(userId: string) {
  return prisma.event.findMany({
    where: { ownerId: userId },
    include: {
      theme: true,
      order: { include: { plan: true } },
      guests: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listEligibleOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId, status: OrderStatus.PAID, event: null },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPublishedThemes() {
  return prisma.theme.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
  });
}

export interface CreateEventInput {
  orderId: string;
  type: EventType;
  name: string;
  groomNameEn: string;
  brideNameEn: string;
  invitationTextAr: string;
  eventDate: Date;
  locationName: string;
  mapUrl?: string;
  musicYoutubeId?: string;
  themeId: string;
  guestManagementMode: EventGuestManagementMode;
  rsvpRequired: boolean;
}

export async function createEvent(userId: string, input: CreateEventInput) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { event: true } });
  if (!order || order.userId !== userId) throw new EventError("Order not found");
  if (order.status !== OrderStatus.PAID) throw new EventError("Order is not paid");
  if (order.event) throw new EventError("Order already has an event");

  const theme = await prisma.theme.findUnique({ where: { id: input.themeId } });
  if (!theme || theme.status !== "PUBLISHED") throw new EventError("Theme not available");

  return prisma.event.create({
    data: {
      ownerId: userId,
      orderId: order.id,
      type: input.type,
      name: input.name,
      groomNameEn: input.groomNameEn,
      brideNameEn: input.brideNameEn,
      invitationTextAr: input.invitationTextAr,
      eventDate: input.eventDate,
      locationName: input.locationName,
      mapUrl: input.mapUrl || null,
      musicYoutubeId: input.musicYoutubeId || null,
      themeId: input.themeId,
      guestManagementMode: input.guestManagementMode,
      rsvpRequired: input.rsvpRequired,
    },
  });
}

export async function getOwnedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      theme: true,
      order: { include: { plan: true } },
      guests: { include: { invitation: true }, orderBy: { createdAt: "desc" } },
      gateStaffAssignments: { include: { gateStaff: { include: { user: true } } }, where: { revokedAt: null } },
    },
  });
  if (!event || event.ownerId !== userId) return null;
  return event;
}
