import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import {
  DesignRequestStatus,
  OrderKind,
  PaymentProvider,
  ThemeEngine,
  ThemeStatus,
} from "@/generated/prisma/client";
import { generateReferenceCode } from "@/lib/events/reference-code";
import { chargeableOrderProvider, PaymentsUnavailableError } from "@/lib/payments/moyasar";
import { assignThemeToEvent } from "@/lib/admin/themes/service";
import { CUSTOM_DESIGN_PRICE_SAR } from "@/lib/design-requests/pricing";

export class DesignRequestError extends Error {}

/**
 * A custom design request, start to finish.
 *
 * The shape of the flow is decided by one fact about the rest of the product:
 * the event form is a one-shot write with no customer-facing edit. A design
 * that takes days therefore CANNOT be a step inside it — the customer would
 * have to abandon a filled-in form and come back. So the request rides along
 * with event creation, the event is created immediately on a stock design, and
 * the finished design REPLACES it later via `assignThemeToEvent`, which the
 * admin side already does and which leaves every invitation link untouched.
 */

/** The brief, in the gallery's own vocabulary rather than a second one. */
export interface DesignBrief {
  colorTags: string[];
  styleCategory?: string | null;
  inspirationThemeId?: string | null;
  notes?: string | null;
}

const MAX_NOTE_LENGTH = 2000;
const MAX_COLOR_TAGS = 6;

function cleanBrief(brief: DesignBrief): DesignBrief {
  return {
    colorTags: Array.from(new Set(brief.colorTags.filter(Boolean))).slice(0, MAX_COLOR_TAGS),
    styleCategory: brief.styleCategory?.trim() || null,
    inspirationThemeId: brief.inspirationThemeId || null,
    notes: brief.notes?.trim().slice(0, MAX_NOTE_LENGTH) || null,
  };
}

/**
 * The row a request is, minus its event.
 *
 * Returned as data rather than written here so that a request made DURING event
 * creation can ride along as a nested create in the same insert — a brief for a
 * wedding whose row failed to write helps nobody, and the event create already
 * retries on a reference-code collision, which regenerates this one too.
 */
export function designRequestCreateData(userId: string, brief: DesignBrief) {
  const clean = cleanBrief(brief);
  return {
    reference: generateReferenceCode(),
    userId,
    colorTags: clean.colorTags,
    styleCategory: clean.styleCategory,
    inspirationThemeId: clean.inspirationThemeId,
    notes: clean.notes,
    // Snapshotted, so re-pricing the service tomorrow never re-prices a request
    // already being worked on.
    priceSar: CUSTOM_DESIGN_PRICE_SAR,
  };
}

/** Starting one later, from the event page, for a customer who did not tick the box. */
export async function createDesignRequestForEvent(
  userId: string,
  eventId: string,
  brief: DesignBrief,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, ownerId: true, designRequest: { select: { id: true } } },
  });
  if (!event || event.ownerId !== userId) throw new DesignRequestError("Event not found");
  if (event.designRequest) throw new DesignRequestError("This event already has a design request");

  return prisma.customDesignRequest.create({
    data: { ...designRequestCreateData(userId, brief), eventId },
  });
}

const REQUEST_INCLUDE = {
  event: { select: { id: true, name: true, themeId: true } },
  user: { select: { id: true, name: true, phone: true } },
  inspirationTheme: { select: { id: true, nameAr: true, name: true } },
  deliveredTheme: { select: { id: true, nameAr: true, name: true, engine: true } },
  order: { select: { id: true, status: true, amount: true } },
} as const;

export async function getDesignRequestForEvent(eventId: string, userId: string) {
  const request = await prisma.customDesignRequest.findUnique({
    where: { eventId },
    include: REQUEST_INCLUDE,
  });
  if (!request || request.userId !== userId) return null;
  return request;
}

export async function getDesignRequest(requestId: string) {
  return prisma.customDesignRequest.findUnique({
    where: { id: requestId },
    include: REQUEST_INCLUDE,
  });
}

/** The admin queue. Open requests first — a finished one is not work. */
export async function listDesignRequests() {
  return prisma.customDesignRequest.findMany({
    include: REQUEST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function countOpenDesignRequests() {
  return prisma.customDesignRequest.count({
    where: {
      status: {
        in: [
          DesignRequestStatus.NEW,
          DesignRequestStatus.IN_PROGRESS,
          DesignRequestStatus.CHANGES_REQUESTED,
        ],
      },
    },
  });
}

// ---------------------------------------------------------------------------
// The team's side
// ---------------------------------------------------------------------------

export async function startDesignWork(requestId: string, adminNote?: string | null) {
  return prisma.customDesignRequest.update({
    where: { id: requestId },
    data: {
      status: DesignRequestStatus.IN_PROGRESS,
      adminNote: adminNote?.trim() || undefined,
    },
  });
}

/**
 * Hands the finished design to the customer to look at.
 *
 * The theme is NOT granted to them here, deliberately. A granted PRIVATE theme
 * shows up in their picker, and a customer who has not created their event yet
 * could simply select it — the fee is charged for a design they would already
 * have. They preview it instead, and the grant happens at payment.
 */
export async function markDesignReady(
  requestId: string,
  themeId: string,
  adminId: string,
  adminNote?: string | null,
) {
  const theme = await prisma.theme.findUnique({
    where: { id: themeId },
    select: { id: true, engine: true, status: true },
  });
  if (!theme) throw new DesignRequestError("Theme not found");
  // Both checks exist because failing them fails SILENTLY, days later:
  // an unpublished design lands on the event but never appears in the
  // customer's own picker (`listPublishedThemes` filters on status), and a
  // LEGACY one has no preview page at all — so the customer would be asked to
  // approve a design they cannot look at.
  if (theme.status !== ThemeStatus.PUBLISHED) {
    throw new DesignRequestError("التصميم لازم يكون منشوراً قبل ما يُسلَّم للعميل");
  }
  if (theme.engine !== ThemeEngine.BUILDER) {
    throw new DesignRequestError("التصميم المخصص لازم يكون من محرر التصاميم");
  }

  return prisma.customDesignRequest.update({
    where: { id: requestId },
    data: {
      status: DesignRequestStatus.READY,
      deliveredThemeId: themeId,
      deliveredById: adminId,
      deliveredAt: new Date(),
      adminNote: adminNote?.trim() || undefined,
    },
  });
}

export async function cancelDesignRequest(requestId: string, adminNote?: string | null) {
  return prisma.customDesignRequest.update({
    where: { id: requestId },
    data: { status: DesignRequestStatus.CANCELLED, adminNote: adminNote?.trim() || undefined },
  });
}

// ---------------------------------------------------------------------------
// The customer's side
// ---------------------------------------------------------------------------

/** "Not quite — change this." Sends it back for another round. */
export async function requestDesignChanges(requestId: string, userId: string, note: string) {
  const request = await prisma.customDesignRequest.findUnique({ where: { id: requestId } });
  if (!request || request.userId !== userId) throw new DesignRequestError("Request not found");
  if (request.status !== DesignRequestStatus.READY) {
    throw new DesignRequestError("Only a design that is ready can be sent back");
  }

  return prisma.customDesignRequest.update({
    where: { id: requestId },
    data: {
      status: DesignRequestStatus.CHANGES_REQUESTED,
      revisionCount: { increment: 1 },
      revisionNote: note.trim().slice(0, MAX_NOTE_LENGTH) || null,
    },
  });
}

/** Refuses to raise a design fee a production without payment keys could only "mock-settle". */
function designFeeProvider(): PaymentProvider {
  try {
    return chargeableOrderProvider() === "MOYASAR" ? PaymentProvider.MOYASAR : PaymentProvider.MOCK;
  } catch (err) {
    if (err instanceof PaymentsUnavailableError) throw new DesignRequestError("Payments are not configured");
    throw err;
  }
}

/**
 * "I like it" — the moment money becomes owed, and the first moment it does.
 *
 * Returns the order to pay. Re-approving an already-approved request returns
 * the order that already exists rather than a second one: the customer landing
 * on this twice (a double tap, a back button) must not owe 300.
 */
export async function approveDesign(requestId: string, userId: string) {
  const request = await prisma.customDesignRequest.findUnique({
    where: { id: requestId },
    include: { order: true },
  });
  if (!request || request.userId !== userId) throw new DesignRequestError("Request not found");

  if (request.order) return request.order;
  if (request.status !== DesignRequestStatus.READY) {
    throw new DesignRequestError("Only a design that is ready can be approved");
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId,
        kind: OrderKind.CUSTOM_DESIGN,
        // No plan, no invitations, no unit price: this order buys a service.
        // `kind` is what keeps it out of listEligibleOrders, where it would
        // otherwise read as a package waiting to be spent on a free event.
        amount: request.priceSar,
        provider: designFeeProvider(),
        idempotencyKey: randomUUID(),
      },
    });
    await tx.customDesignRequest.update({
      where: { id: request.id },
      data: { status: DesignRequestStatus.APPROVED, orderId: order.id },
    });
    return order;
  });
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/**
 * Everything that happens the moment a design fee is paid.
 *
 * Called from `fulfilPaidOrder`, which every payment path funnels through —
 * mock, the Moyasar redirect, and the webhook. Wiring it into only the path
 * being tested today is exactly how a fulfilment step silently stops happening
 * the day real card payments are switched on.
 *
 * Idempotent: a webhook that arrives twice, or after the redirect already
 * settled the order, must not re-grant or re-assign.
 */
export async function deliverPaidDesign(orderId: string): Promise<void> {
  const request = await prisma.customDesignRequest.findUnique({ where: { orderId } });
  if (!request) return;
  if (request.status === DesignRequestStatus.PAID) return;
  if (!request.deliveredThemeId || !request.deliveredById) {
    throw new DesignRequestError("Paid design request has no delivered theme");
  }

  // The grant is what puts the design in this customer's own picker from now
  // on; the event assignment is what puts it on the invitation they already
  // created. Both are needed: the first is ownership, the second is delivery.
  await prisma.themeAssignment.upsert({
    where: { themeId_userId: { themeId: request.deliveredThemeId, userId: request.userId } },
    create: {
      themeId: request.deliveredThemeId,
      userId: request.userId,
      assignedById: request.deliveredById,
    },
    update: {},
  });

  await assignThemeToEvent(request.deliveredThemeId, request.eventId, request.deliveredById);

  await prisma.customDesignRequest.update({
    where: { id: request.id },
    data: { status: DesignRequestStatus.PAID, paidAt: new Date() },
  });
}

/**
 * Whether this viewer may see a design that has not been paid for yet.
 *
 * The preview route is otherwise admin-only. A customer gets in for exactly
 * one theme — the one their own request is waiting on — because the entire
 * premise is that they decide before paying.
 */
export async function mayPreviewDeliveredTheme(themeId: string, userId: string): Promise<boolean> {
  const request = await prisma.customDesignRequest.findFirst({
    where: {
      userId,
      deliveredThemeId: themeId,
      status: {
        in: [
          DesignRequestStatus.READY,
          DesignRequestStatus.CHANGES_REQUESTED,
          DesignRequestStatus.APPROVED,
          DesignRequestStatus.PAID,
        ],
      },
    },
    select: { id: true },
  });
  return Boolean(request);
}

/** Order status is not the same question as "is the order PAID" — see `approveDesign`. */
export function isAwaitingPayment(status: DesignRequestStatus): boolean {
  return status === DesignRequestStatus.APPROVED;
}
