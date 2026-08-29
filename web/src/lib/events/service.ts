import "server-only";
import { prisma } from "@/lib/db/client";
import {
  EventGuestManagementMode,
  EventType,
  OrderKind,
  OrderStatus,
  Prisma,
  ThemeVisibility,
} from "@/generated/prisma/client";
import type { ScheduleItem } from "@/lib/events/types";
import { generateReferenceCode } from "@/lib/events/reference-code";
import type { CoupleInput } from "@/lib/themes/builder/content";
import { orderTerms } from "@/lib/orders/terms";
import { designRequestCreateData, type DesignBrief } from "@/lib/design-requests/service";

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

/**
 * Paid orders this customer can still turn into an event.
 *
 * `kind` is load-bearing, not decoration: a paid custom-design fee is also a
 * PAID order with no event attached, so without this filter it would appear
 * here as a package waiting to be spent — and 150 riyals of design work would
 * buy a free wedding with unlimited invitations.
 */
export async function listEligibleOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId, kind: OrderKind.INVITATIONS, status: OrderStatus.PAID, event: null },
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
  musicYoutubeId?: string | null;
  musicAutoplay?: boolean;
  scheduleItems?: ScheduleItem[];
  notesAr?: string;
  themeId: string;
  /** Chosen colour of a BUILDER theme; null for LEGACY themes. */
  themeVariantId?: string | null;
  guestManagementMode: EventGuestManagementMode;
  rsvpRequired: boolean;
  allowGuestPartySize: boolean;
  /**
   * Set when the customer ticked "design one for me" in the picker. The event
   * is still created on the stock theme they chose — the custom design replaces
   * it later — so this only records the brief, and never blocks creation.
   */
  designBrief?: DesignBrief | null;
}

export async function createEvent(userId: string, input: CreateEventInput) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { event: true } });
  if (!order || order.userId !== userId) throw new EventError("Order not found");
  if (order.status !== OrderStatus.PAID) throw new EventError("Order is not paid");
  if (order.event) throw new EventError("Order already has an event");

  await assertThemeSelectable(input.themeId, input.themeVariantId ?? null);
  assertCoupleCount(input.couples);

  // Snapshotted from the order, not read through it later: the guest page must
  // be able to answer "does this invitation have a QR?" without joining the
  // order, and a later price-list edit must never change what was already sold.
  const { hasQr } = orderTerms(order);

  return createEventWithUniqueReferenceCode(userId, order.id, input, hasQr);
}

/**
 * A theme+colour pair the browser sent is only usable if it really is a pair:
 * an event pointing at another design's colour would render that design's
 * artwork on this invitation.
 *
 * `alsoAllowThemeId` exists for the admin edit form — an event whose design was
 * archived after it was created must still be saveable without support being
 * forced to move the invitation onto a different design first.
 */
async function assertThemeSelectable(
  themeId: string,
  themeVariantId: string | null,
  alsoAllowThemeId?: string,
) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme || (theme.status !== "PUBLISHED" && theme.id !== alsoAllowThemeId)) {
    throw new EventError("Theme not available");
  }

  if (themeVariantId) {
    const variant = await prisma.themeVariant.findUnique({
      where: { id: themeVariantId },
      select: { themeId: true },
    });
    if (!variant || variant.themeId !== theme.id) throw new EventError("Theme color not available");
  }
}

function assertCoupleCount(couples: CoupleInput[]) {
  if (couples.length === 0) throw new EventError("At least one couple is required");
  if (couples.length > MAX_COUPLES_PER_EVENT) throw new EventError("Too many couples");
}

/** The primary couple is mirrored onto Event's own columns — see CreateEventInput. */
function primaryCoupleColumns(couples: CoupleInput[]) {
  const [primary] = couples;
  return {
    groomNameEn: primary.groomNameEn,
    brideNameEn: primary.brideNameEn,
    groomNameAr: primary.groomNameAr || null,
    groomFamilyAr: primary.groomFamilyAr || null,
    brideNameAr: primary.brideNameAr || null,
    brideFamilyAr: primary.brideFamilyAr || null,
  };
}

function coupleRows(couples: CoupleInput[]) {
  return couples.map((couple, index) => ({
    sortOrder: index,
    groomNameEn: couple.groomNameEn,
    brideNameEn: couple.brideNameEn,
    groomNameAr: couple.groomNameAr || null,
    groomFamilyAr: couple.groomFamilyAr || null,
    brideNameAr: couple.brideNameAr || null,
    brideFamilyAr: couple.brideFamilyAr || null,
  }));
}

/** Everything the event form writes; `orderId` is not among it — a paid order is not re-pointed. */
/**
 * `designBrief` is excluded: it is a request made once, when the event is
 * created. Support editing an event's names must not silently open a second
 * design request, and un-ticking the box must not close an existing one — that
 * lives on its own screen.
 */
export type UpdateEventDetailsInput = Omit<CreateEventInput, "orderId" | "designBrief">;

/**
 * Rewrites an existing event's details. Only support reaches this: the customer
 * form is create-only, because the names are already printed on invitations
 * that have been sent by the time anyone wants them changed.
 *
 * The couple rows are replaced wholesale rather than diffed — they carry no
 * identity of their own (nothing references an EventCouple), and a delete +
 * recreate inside one transaction is the only way "remove the middle pair"
 * cannot end up shifting the others.
 */
export async function updateEventDetails(eventId: string, input: UpdateEventDetailsInput) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, themeId: true },
  });
  if (!event) throw new EventError("Event not found");

  assertCoupleCount(input.couples);
  await assertThemeSelectable(input.themeId, input.themeVariantId ?? null, event.themeId);

  const [, updated] = await prisma.$transaction([
    prisma.eventCouple.deleteMany({ where: { eventId } }),
    prisma.event.update({
      where: { id: eventId },
      data: {
        type: input.type,
        name: input.name,
        ...primaryCoupleColumns(input.couples),
        couples: { create: coupleRows(input.couples) },
        familiesGreetingAr: input.familiesGreetingAr || null,
        invitationTextAr: input.invitationTextAr,
        eventDate: input.eventDate,
        locationName: input.locationName,
        regionName: input.regionName || null,
        mapUrl: input.mapUrl || null,
        musicYoutubeId: input.musicYoutubeId || null,
        musicAutoplay: input.musicYoutubeId ? Boolean(input.musicAutoplay) : false,
        scheduleItems:
          input.scheduleItems && input.scheduleItems.length > 0
            ? (input.scheduleItems as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        notesAr: input.notesAr || null,
        themeId: input.themeId,
        themeVariantId: input.themeVariantId ?? null,
        guestManagementMode: input.guestManagementMode,
        rsvpRequired: input.rsvpRequired,
        allowGuestPartySize: input.allowGuestPartySize,
      },
    }),
  ]);
  return updated;
}

/** referenceCode is unique app-wide; retries a few times on the (extremely rare) collision. */
async function createEventWithUniqueReferenceCode(
  userId: string,
  orderId: string,
  input: CreateEventInput,
  hasQr: boolean,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.event.create({
        data: {
          ownerId: userId,
          orderId,
          referenceCode: generateReferenceCode(),
          type: input.type,
          name: input.name,
          // Set explicitly rather than leaning on the column default: the default
          // is `true` so that no existing wedding loses its door scanning, which
          // means a forgotten assignment here would silently GIVE a no-QR
          // customer the paid product.
          hasQr,
          ...primaryCoupleColumns(input.couples),
          // Nested creates run inside the same transaction as the event row, so
          // an event can never exist with a half-written couple list.
          couples: { create: coupleRows(input.couples) },
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
          // Same insert as the event itself, for the same reason the couples
          // are: a brief for a wedding whose row failed to write is orphaned
          // data, and the retry below regenerates its reference code too.
          designRequest: input.designBrief
            ? { create: designRequestCreateData(userId, input.designBrief) }
            : undefined,
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
      guests: {
        include: {
          invitation: {
            include: {
              // The guest's own reply: how many are actually coming and any
              // note they left. Only the latest matters — a guest who changes
              // their mind writes a second row rather than editing the first.
              rsvps: { orderBy: { respondedAt: "desc" }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!event || event.ownerId !== userId) return null;
  return event;
}

/**
 * An event plus everything the edit form needs to render its current values.
 * Deliberately without the guest list: the form rewrites the event's own
 * details, and pulling several hundred guests in to draw a text field is work
 * nobody asked for.
 */
export async function getEventForEdit(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      couples: COUPLES_INCLUDE,
      owner: { select: { id: true, name: true, phone: true } },
      order: { include: { plan: true } },
    },
  });
}
