import "server-only";
import { prisma } from "@/lib/db/client";
import { lockKey } from "@/lib/db/lock";
import { PAYABLE_ORDER_STATUSES } from "@/lib/orders/status";
import { OrderStatus, Prisma } from "@/generated/prisma/client";
import {
  codeRefusal,
  normalizeCode,
  type DiscountCodeInput,
  type DiscountRefusal,
} from "@/lib/discounts/rules";

/** A code refused at checkout, carrying the reason the page prints. */
export class DiscountError extends Error {
  constructor(readonly reason: DiscountRefusal) {
    super(`Discount code refused: ${reason}`);
  }
}

/** How long presenting a discounted checkout holds one of the code's uses. */
export const DISCOUNT_RESERVATION_MS = 30 * 60 * 1000;

/**
 * Serialises every decision about one code's remaining uses — reserving at
 * checkout, renewing, and settling without a card — so two customers can never
 * both take the last one.
 */
export async function lockDiscountCode(tx: Prisma.TransactionClient, codeId: string): Promise<void> {
  await lockKey(tx, "discount-code", codeId);
}

/**
 * Uses that count against `maxUses`: PAID orders carrying the code, plus
 * unpaid ones whose reservation is still live. `excludeOrderId` leaves out the
 * order asking, so it is judged against everybody else.
 */
export function heldUses(
  tx: Prisma.TransactionClient,
  codeId: string,
  now: Date,
  excludeOrderId?: string,
  /** Also ignore reservations held by unpaid orders for this draft — the ones a re-price is about to supersede. */
  excludeDraftEventId?: string,
): Promise<number> {
  const liveReservation: Prisma.OrderWhereInput = {
    status: { in: PAYABLE_ORDER_STATUSES },
    discountReservedUntil: { gt: now },
    ...(excludeDraftEventId ? { NOT: { draftEventId: excludeDraftEventId } } : {}),
  };
  return tx.order.count({
    where: {
      discountCodeId: codeId,
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      OR: [{ status: OrderStatus.PAID }, liveReservation],
    },
  });
}

/**
 * The code a customer typed, if it may be used right now. Throws DiscountError
 * otherwise. A pre-check only: the use itself is reserved under the code's lock
 * when the order is written (see `createPerInvitationOrder`).
 */
export async function requireUsableCode(raw: string, draftEventId?: string, now: Date = new Date()) {
  const code = await prisma.discountCode.findUnique({ where: { code: normalizeCode(raw) } });
  if (!code) throw new DiscountError("unknown");
  // Her own unpaid order for the same draft is about to be superseded, so the
  // use it holds is hers to carry over, not someone else's.
  const refusal = codeRefusal(code, await heldUses(prisma, code.id, now, undefined, draftEventId), now);
  if (refusal) throw new DiscountError(refusal);
  return code;
}

/**
 * Whether the code on an unpaid order still holds — and, if it does, renews
 * the order's reservation. Called before the card form is offered, so an order
 * raised on the code's last day cannot be paid at its price a week later, and
 * so no discounted checkout is ever presented without a use held for it.
 */
export async function holdOrderCode(orderId: string, now: Date = new Date()): Promise<DiscountRefusal | null> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, discountCodeId: true },
    });
    if (!order?.discountCodeId) return null;
    await lockDiscountCode(tx, order.discountCodeId);

    const code = await tx.discountCode.findUnique({ where: { id: order.discountCodeId } });
    if (!code) return "unknown";
    const refusal = codeRefusal(code, await heldUses(tx, code.id, now, order.id), now);
    if (refusal) return refusal;

    await tx.order.updateMany({
      where: { id: order.id, status: { in: PAYABLE_ORDER_STATUSES } },
      data: { discountReservedUntil: new Date(now.getTime() + DISCOUNT_RESERVATION_MS) },
    });
    return null;
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Every code, newest first, with how many paid orders used it and whether any order touched it. */
export async function listDiscountCodes() {
  const [codes, paid] = await Promise.all([
    prisma.discountCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true } } },
    }),
    prisma.order.groupBy({
      by: ["discountCodeId"],
      where: { discountCodeId: { not: null }, status: OrderStatus.PAID },
      _count: { _all: true },
    }),
  ]);
  const usesOf = new Map(paid.map((row) => [row.discountCodeId, row._count._all]));
  return codes.map((code) => ({
    ...code,
    value: Number(code.value),
    paidUses: usesOf.get(code.id) ?? 0,
    // Any order at all — even a cancelled one — pins the code: deleting it
    // would leave that order's discount with no name.
    deletable: code._count.orders === 0,
  }));
}

export function getDiscountCode(id: string) {
  return prisma.discountCode.findUnique({ where: { id } });
}

export class DiscountCodeTakenError extends Error {}

export async function createDiscountCode(input: DiscountCodeInput) {
  try {
    return await prisma.discountCode.create({
      data: { ...input, value: input.value.toFixed(2) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DiscountCodeTakenError();
    }
    throw err;
  }
}

/**
 * Everything but the code itself, which stays as the customers were given it.
 * Orders already raised keep the discount they were priced with.
 */
export async function updateDiscountCode(id: string, input: Omit<DiscountCodeInput, "code">) {
  await prisma.discountCode.update({
    where: { id },
    data: { ...input, value: input.value.toFixed(2) },
  });
}

export async function setDiscountCodeActive(id: string, active: boolean) {
  await prisma.discountCode.update({ where: { id }, data: { active } });
}

/** Only a code no order ever carried; the others are switched off instead. */
export async function deleteUnusedDiscountCode(id: string): Promise<boolean> {
  const { count } = await prisma.discountCode.deleteMany({ where: { id, orders: { none: {} } } });
  return count === 1;
}
