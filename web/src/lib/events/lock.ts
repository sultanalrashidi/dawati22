import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Freezes an event's names, date and venue.
 *
 * Called from the two places that write `Invitation.sentAt`, and from nowhere
 * else: the lock means "an invitation actually reached a guest", so it is a
 * CONSEQUENCE of that column moving, never an independent decision. Not at
 * payment — completing the details and previewing come after paying — and not
 * when a guest is added, because adding a guest only prepares the link.
 *
 * `updateMany` with `detailsLockedAt: null` in the filter, not `update` by id:
 * this is a compare-and-set. The FIRST send wins and every later share updates
 * zero rows, so the timestamp keeps meaning "when the data froze" rather than
 * "the last time anyone pressed WhatsApp".
 *
 * Returned un-awaited so the caller can compose it into the same transaction
 * as the `sentAt` write — the two columns must not be able to disagree. Pass
 * `tx` inside an interactive transaction; the default client would run this
 * outside it, which is exactly the disagreement the composition prevents.
 */
export function lockEventDetailsOp(
  eventId: string,
  at: Date,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return client.event.updateMany({
    where: { id: eventId, detailsLockedAt: null },
    data: { detailsLockedAt: at },
  });
}
