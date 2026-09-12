import { OrderStatus } from "@/generated/prisma/enums";

/**
 * The statuses an order can still be paid from: PENDING, and FAILED.
 *
 * A declined card fails one PAYMENT, not the order. Moyasar's form keeps the
 * card fields on screen after a decline, and her second try is a new payment
 * against the same order. When FAILED was terminal, that second try went
 * through at Moyasar and was then refused here — the card charged and nothing
 * delivered. The 2026-09-12 trial hit exactly that on a 150 SAR design fee.
 *
 * CANCELLED (superseded by a newer order) and REFUNDED stay closed: paying one
 * of those buys something that can never be delivered.
 *
 * Its own module, free of `server-only`, so the checkout page, the order
 * service and the draft service all read the one list.
 */
export const PAYABLE_ORDER_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.FAILED];

export function isPayableOrderStatus(status: OrderStatus): boolean {
  return PAYABLE_ORDER_STATUSES.includes(status);
}
