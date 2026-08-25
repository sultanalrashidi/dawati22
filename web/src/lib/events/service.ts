import "server-only";
import { prisma } from "@/lib/db/client";
import {
  EventGuestManagementMode,
  EventType,
  OrderStatus,
  Prisma,
  ThemeVisibility,
} from "@/generated/prisma/client";
import type { ScheduleItem } from "@/lib/events/types";
import { generateReferenceCode } from "@/lib/events/reference-code";
import type { CoupleInput } from "@/lib/themes/builder/content";

export class EventError extends Error {}

/** How many couples one event may announce — a joint wedding, not a directory. */
export const MAX_COUPLES_PER_EVENT = 6;

/**
 * Anything shaped enough to answer "who is getting married?": the singular
 * columns Event has always carried, plus the optional EventCouple rows. Widened
 * to a structural type so a query that skipped `include: { couples: true }`
 * still type-checks and still gets an answer.
 */
export interface CouplesSource {
  groomNameEn: string;
  brideNameEn: string;
  groomNameAr: string | null;
  groomFamilyAr: string | null;
  brideNameAr: string | null;
  brideFamilyAr: string | null;
  couples?: readonly (CoupleInput & { sortOrder?: number })[] | null;
}

/**
 * The event's couples, ordered, and never empty: an event created before the
 * EventCouple table existed (or read without its rows) still answers with the
 * one couple its own columns describe. Callers can therefore treat
 * `couples[0]` as the primary couple unconditionally.
 */
export function couplesFor(event: CouplesSource): CoupleInput[] {
  const rows = event.couples ?? [];
  if (rows.length > 0) {
    return [...rows]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((couple) => ({
        groomNameEn: couple.groomNameEn,
        brideNameEn: couple.brideNameEn,
        groomNameAr: couple.groomNameAr,
        groomFamilyAr: couple.groomFamilyAr,
        brideNameAr: couple.brideNameAr,
        brideFamilyAr: couple.brideFamilyAr,
      }));
  }
  return [
    {
      groomNameEn: event.groomNameEn,
      brideNameEn: event.brideNameEn,
      groomNameAr: event.groomNameAr,
      groomFamilyAr: event.groomFamilyAr,
      brideNameAr: event.brideNameAr,
      brideFamilyAr: event.brideFamilyAr,
    },
  ];
}

/** Shared by every query that has to render an invitation's names. */
const COUPLES_INCLUDE = { orderBy: { sortOrder: "asc" } } as const;

export async function listOwnedEvents(userId: string) {
  return prisma.event.findMany({
    where: { ownerId: userId },
    include: {
      theme: true,
      order: { include: { plan: true } },
      couples: COUPLES_INCLUDE,
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

/**
 * Every published theme this viewer may choose from: the PUBLIC catalogue, plus
 * the PRIVATE designs an admin granted them by name. A logged-out visitor
 * (`userId === null`) sees only the PUBLIC ones.
 *
 * `variants` comes along for BUILDER themes, whose colors live on ThemeVariant
 * rather than in `config`; it is an empty array for every LEGACY theme, so
 * their callers are unaffected.
 */
export async function listPublishedThemes(userId: string | null) {
  const themes = await prisma.theme.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { visibility: ThemeVisibility.PUBLIC },
        ...(userId
          ? [{ visibility: ThemeVisibility.PRIVATE, assignments: { some: { userId } } }]
          : []),
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { events: true } },
      variants: {
        select: {
          id: true,
          slug: true,
          nameAr: true,
          name: true,
          colorTag: true,
          palette: true,
          sortOrder: true,
          isDefault: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  return themes.map(({ _count, ...theme }) => ({ ...theme, eventCount: _count.events }));
}

export interface CreateEventInput {
  orderId: string;
  type: EventType;
  name: string;
  /**
   * At least one, at most MAX_COUPLES_PER_EVENT. The first is the primary
   * couple and is also written to Event's own groom/bride columns, so every
   * existing read of those keeps working exactly as it did.
   */
  couples: CoupleInput[];
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
  /** Chosen colour of a BUILDER theme; null for LEGACY themes. */
  themeVariantId?: string | null;
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

  // The colour id comes from the browser alongside the theme id, so the pair
  // has to be re-checked: an event pointing at another design's colour would
  // render that design's artwork on this invitation.
  if (input.themeVariantId) {
    const variant = await prisma.themeVariant.findUnique({
      where: { id: input.themeVariantId },
      select: { themeId: true },
    });
    if (!variant || variant.themeId !== theme.id) throw new EventError("Theme color not available");
  }

  if (input.couples.length === 0) throw new EventError("At least one couple is required");
  if (input.couples.length > MAX_COUPLES_PER_EVENT) throw new EventError("Too many couples");

  return createEventWithUniqueReferenceCode(userId, order.id, input);
}

/** referenceCode is unique app-wide; retries a few times on the (extremely rare) collision. */
async function createEventWithUniqueReferenceCode(userId: string, orderId: string, input: CreateEventInput) {
  const [primary] = input.couples;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.event.create({
        data: {
          ownerId: userId,
          orderId,
          referenceCode: generateReferenceCode(),
          type: input.type,
          name: input.name,
          groomNameEn: primary.groomNameEn,
          brideNameEn: primary.brideNameEn,
          groomNameAr: primary.groomNameAr || null,
          groomFamilyAr: primary.groomFamilyAr || null,
          brideNameAr: primary.brideNameAr || null,
          brideFamilyAr: primary.brideFamilyAr || null,
          // Nested creates run inside the same transaction as the event row, so
          // an event can never exist with a half-written couple list.
          couples: {
            create: input.couples.map((couple, index) => ({
              sortOrder: index,
              groomNameEn: couple.groomNameEn,
              brideNameEn: couple.brideNameEn,
              groomNameAr: couple.groomNameAr || null,
              groomFamilyAr: couple.groomFamilyAr || null,
              brideNameAr: couple.brideNameAr || null,
              brideFamilyAr: couple.brideFamilyAr || null,
            })),
          },
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
          themeVariantId: input.themeVariantId ?? null,
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
      couples: COUPLES_INCLUDE,
      guests: { include: { invitation: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!event || event.ownerId !== userId) return null;
  return event;
}
