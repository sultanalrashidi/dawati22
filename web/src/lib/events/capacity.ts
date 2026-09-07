import { orderTerms, type OrderTermsSource } from "@/lib/orders/terms";

/**
 * How many invitations this event may hold — which is NOT what it was sold.
 *
 * Deliberately outside `src/lib/orders/`. `orderTerms()` takes an Order and
 * cannot see an Event, and that limitation is load-bearing: its output is the
 * activation receipt, the admin order ledger and the description Moyasar is
 * reconciled against. Folding a hand-granted count into it would make a
 * permanent receipt state a number nobody paid for, next to the amount that
 * was actually charged. So the two ideas get two functions, and the compiler
 * keeps them apart.
 *
 *   `orderTerms(order).invitationCount` → what she PAID for
 *   `eventCapacity(event)`              → what she may USE
 *
 * Fails closed on a draft. `orderTerms` already returns zero for a null order
 * so that an unpaid invitation can never take a guest; adding the grant back
 * on top would re-open exactly that hole — grant +50 to a draft, let her pay
 * the 25 minimum, and she holds 75 while her order, her receipt and Moyasar
 * all say 25.
 */
export interface EventCapacitySource {
  orderId: string | null;
  extraInvitationCount: number;
  order?: OrderTermsSource | null;
}

export function eventCapacity(event: EventCapacitySource): number {
  if (!event.orderId) return 0;
  // Clamped rather than trusted: a negative column would silently shrink the
  // paid capacity, and the only honest reading of "granted less than nothing"
  // is nothing.
  return orderTerms(event.order).invitationCount + Math.max(0, event.extraInvitationCount);
}

/** Invitations bought, granted, and the total — for screens that must show the split. */
export function capacityBreakdown(event: EventCapacitySource): {
  paid: number;
  granted: number;
  total: number;
} {
  const paid = event.orderId ? orderTerms(event.order).invitationCount : 0;
  const granted = event.orderId ? Math.max(0, event.extraInvitationCount) : 0;
  return { paid, granted, total: paid + granted };
}
