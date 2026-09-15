import "server-only";
import { prisma } from "@/lib/db/client";
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

/** Uses are PAID orders carrying the code — nothing else spends one. */
function paidUses(codeId: string): Promise<number> {
  return prisma.order.count({ where: { discountCodeId: codeId, status: OrderStatus.PAID } });
}

/** The code a customer typed, if it may be used right now. Throws DiscountError otherwise. */
export async function requireUsableCode(raw: string, now: Date = new Date()) {
  const code = await prisma.discountCode.findUnique({ where: { code: normalizeCode(raw) } });
  if (!code) throw new DiscountError("unknown");
  const refusal = codeRefusal(code, await paidUses(code.id), now);
  if (refusal) throw new DiscountError(refusal);
  return code;
}

/**
 * Whether the code already on an unpaid order still holds. Asked again before
 * the card form is offered, so an order raised on the code's last day cannot
 * be paid at its price a week later.
 */
export async function orderCodeRefusal(codeId: string, now: Date = new Date()): Promise<DiscountRefusal | null> {
  const code = await prisma.discountCode.findUnique({ where: { id: codeId } });
  if (!code) return "unknown";
  return codeRefusal(code, await paidUses(code.id), now);
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
