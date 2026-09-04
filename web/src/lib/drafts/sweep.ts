import "server-only";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";

/**
 * Deleting drafts nobody came back for.
 *
 * The rule the owner settled: 30 days from the last edit, ANONYMOUS drafts
 * only. A signed-in customer's unpaid draft is never swept — she sees it under
 * «دعوات غير مكتملة» and deletes it herself. That asymmetry is deliberate:
 * an owned draft has somebody who can ask for it back, and an ownerless one
 * has nobody at all, which is exactly why it must not be kept indefinitely.
 *
 * It matters because the free-first journey collects real personal data before
 * anyone signs in — the couple's names, the date, the venue, the mothers'
 * kunyas — on a row identified only by a browser cookie. Keeping that forever
 * is not something the privacy policy could honestly describe.
 *
 * NOT to be confused with `Event.expiresAt`. Nothing writes that column, but
 * the door scanner READS it (`checkin/service.ts`) and denies entry when it is
 * in the past — repurposing it as a retention clock would silently start
 * turning guests away at real weddings.
 */

export const DRAFT_RETENTION_DAYS = 30;
/** The rate-limit ledger is operational exhaust, not customer data. */
const ATTEMPT_RETENTION_DAYS = 7;

const BATCH_SIZE = 100;
/**
 * A time budget rather than a fixed number of batches.
 *
 * One address may legally start 20 drafts an hour — 480 a day — so a nightly
 * job with a hard ceiling below that could fall permanently behind, and the
 * "30 days" in the privacy policy would quietly stop being true. Bounded by
 * the clock instead, so a quiet night finishes early and a busy one still
 * finishes inside the function's own limit.
 */
const TIME_BUDGET_MS = 20_000;

export function draftRetentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - DRAFT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * What counts as abandoned. One definition, used by the sweep, the dry run and
 * the admin count, so they can never drift apart.
 *
 * `ownerId: null` is the load-bearing clause. Ownership is a one-way door —
 * `claimDraft` only ever sets it — and the only two places that create an
 * Event either set no owner (a draft) or always set one (a paid event). So an
 * ownerless row is unpaid by construction, which in turn means it has no
 * guests (the paywall in `guests/service.ts` refuses to mint an invitation for
 * an event with no order) and no reference code for the door scanner to find.
 *
 * `orderId: null` and the order check are belt and braces on top of that: a
 * draft with money in flight must not be deletable, and `Order.draftEventId`
 * is onDelete Restrict, so the database would refuse anyway.
 */
export function abandonedDraftWhere(cutoff: Date) {
  return {
    ownerId: null,
    orderId: null,
    updatedAt: { lt: cutoff },
    pendingOrders: { none: {} },
  } as const;
}

export async function countAbandonedDrafts(cutoff = draftRetentionCutoff()): Promise<number> {
  return prisma.event.count({ where: abandonedDraftWhere(cutoff) });
}

export interface SweepResult {
  deleted: number;
  skipped: number;
  attemptsDeleted: number;
  budgetExhausted: boolean;
}

/**
 * Deletes abandoned drafts, oldest first.
 *
 * Row by row rather than one `deleteMany`, and deliberately: `deleteMany`
 * returns a count and nothing else, so a batch statement cannot say WHICH rows
 * went. Each delete re-asserts the whole predicate, so a visitor who comes back
 * mid-sweep is skipped rather than deleted — and because each is its own
 * statement, what gets logged is what actually happened rather than what was
 * selected a moment earlier. At a few hundred rows a night the extra round
 * trips are irrelevant next to being able to answer "did you delete mine?".
 */
export async function sweepAbandonedDrafts({
  dryRun = false,
  now = new Date(),
}: { dryRun?: boolean; now?: Date } = {}): Promise<SweepResult> {
  const startedAt = Date.now();
  const cutoff = draftRetentionCutoff(now);
  let deleted = 0;
  let skipped = 0;
  let budgetExhausted = false;

  for (;;) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      budgetExhausted = true;
      break;
    }

    const batch = await prisma.event.findMany({
      where: abandonedDraftWhere(cutoff),
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    if (dryRun) {
      // A rehearsal must not loop forever over rows it is not deleting.
      skipped += batch.length;
      break;
    }

    for (const draft of batch) {
      const removed = await prisma.event.deleteMany({
        where: { id: draft.id, ...abandonedDraftWhere(cutoff) },
      });
      if (removed.count === 0) {
        skipped += 1;
        continue;
      }
      deleted += 1;
      // The id and its age only. Never the names, the venue or the date —
      // the whole point of deleting the row is not to keep that data, and a
      // log line is not an exception to it.
      logger.info("drafts.sweep.deleted", {
        eventId: draft.id,
        lastEditedAt: draft.updatedAt.toISOString(),
      });
    }
  }

  const attemptsDeleted = dryRun ? 0 : await sweepDraftCreationAttempts(now);

  logger.info("drafts.sweep.run", {
    dryRun,
    deleted,
    skipped,
    attemptsDeleted,
    budgetExhausted,
    cutoff: cutoff.toISOString(),
    durationMs: Date.now() - startedAt,
  });

  if (budgetExhausted) {
    // The retention promise is only kept if the job keeps up. Say so loudly
    // rather than letting the backlog be invisible.
    logger.warn("drafts.sweep.backlog", { remaining: await countAbandonedDrafts(cutoff) });
  }

  return { deleted, skipped, attemptsDeleted, budgetExhausted };
}

/**
 * The anonymous rate-limit ledger. One row per accepted draft start, keyed by
 * a hashed address, and only ever read over the last hour — so anything older
 * than a week is pure accumulation.
 */
async function sweepDraftCreationAttempts(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - ATTEMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const removed = await prisma.draftCreationAttempt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return removed.count;
}
