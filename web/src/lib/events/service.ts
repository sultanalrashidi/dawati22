import "server-only";
import { prisma } from "@/lib/db/client";
import { EventGuestManagementMode, EventType, OrderStatus, Prisma } from "@/generated/prisma/client";
import type { ScheduleItem } from "@/lib/events/types";
import { generateReferenceCode } from "@/lib/events/reference-code";

export class EventError extends Error {}

export async function listOwnedEvents(userId: string) {
  return prisma.event.findMany({
    where: { ownerId: userId },
    include: {
      theme: true,
      order: { include: { plan: true } },
      guests: { select: { id: true, invitation: { select: { status: true } } } },
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
  groomNameAr?: string;
  groomFamilyAr?: string;
  brideNameAr?: string;
  brideFamilyAr?: string;
  familiesGreetingAr?: string;
  invitationTextAr: string;
  eventDate: Date;
  locationName: string;
  regionName?: string;
  mapUrl?: string;
  musicYoutubeId?: string;
  musicAutoplay?: boolean;
  scheduleItems?: ScheduleItem[];
  notesAr?: string;
  themeId: string;
  guestManagementMode: EventGuestManagementMode;
  rsvpRequired: boolean;
  allowGuestPartySize: boolean;
}

export async function createEvent(userId: string, input: CreateEventInput) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { event: true } });
  if (!order || order.userId !== userId) throw new EventError("Order not found");
  if (order.status !== OrderStatus.PAID) throw new EventError("Order is not paid");
  if (order.event) throw new EventError("Order already has an event");

  const theme = await prisma.theme.findUnique({ where: { id: input.themeId } });
  if (!theme || theme.status !== "PUBLISHED") throw new EventError("Theme not available");

  return createEventWithUniqueReferenceCode(userId, order.id, input);
}

/** referenceCode is unique app-wide; retries a few times on the (extremely rare) collision. */
async function createEventWithUniqueReferenceCode(userId: string, orderId: string, input: CreateEventInput) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.event.create({
        data: {
          ownerId: userId,
          orderId,
          referenceCode: generateReferenceCode(),
          type: input.type,
          name: input.name,
          groomNameEn: input.groomNameEn,
          brideNameEn: input.brideNameEn,
          groomNameAr: input.groomNameAr || null,
          groomFamilyAr: input.groomFamilyAr || null,
          brideNameAr: input.brideNameAr || null,
          brideFamilyAr: input.brideFamilyAr || null,
          familiesGreetingAr: input.familiesGreetingAr || null,
          invitationTextAr: input.invitationTextAr,
          eventDate: input.eventDate,
          locationName: input.locationName,
          regionName: input.regionName || null,
          mapUrl: input.mapUrl || null,
          musicYoutubeId: input.musicYoutubeId || null,
          musicAutoplay: input.musicYoutubeId ? Boolean(input.musicAutoplay) : false,
          scheduleItems: input.scheduleItems && input.scheduleItems.length > 0
            ? (input.scheduleItems as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          notesAr: input.notesAr || null,
          themeId: input.themeId,
          guestManagementMode: input.guestManagementMode,
          rsvpRequired: input.rsvpRequired,
          allowGuestPartySize: input.allowGuestPartySize,
        },
      });
    } catch (err) {
      const isUniqueCollision = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isUniqueCollision || attempt === 4) throw err;
    }
  }
  throw new EventError("Could not allocate a unique reference code");
}

export async function getOwnedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      theme: true,
      order: { include: { plan: true } },
      guests: { include: { invitation: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!event || event.ownerId !== userId) return null;
  return event;
}
