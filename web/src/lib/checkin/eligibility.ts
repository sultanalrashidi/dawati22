import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Whether an event has a door at all: it has been paid for (activated) and it
 * was sold WITH the QR pass. An event without the pass has no scanner flow —
 * `performCheckIn` already refuses its codes — and so it must not have the rest
 * of the door either: no PIN, no guard session, no guest search, no manual
 * admission. One predicate, used by every one of those entry points, so a new
 * door endpoint cannot quietly apply a looser rule.
 */
export const DOOR_ELIGIBLE_EVENT: Prisma.EventWhereInput = { orderId: { not: null }, hasQr: true };

export async function isDoorEligible(eventId: string): Promise<boolean> {
  const event = await prisma.event.findFirst({ where: { id: eventId, ...DOOR_ELIGIBLE_EVENT }, select: { id: true } });
  return Boolean(event);
}
