import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The first writer this table has ever had.
 *
 * `AuditLog` has been migrated since the beginning and no line of code has
 * touched it. It gets its first row here because a hand-granted invitation is
 * capacity with no money against it: the one change in this product that adds
 * something sellable without a sale to point at.
 *
 * Written as a shared helper on purpose. Twelve admin actions rewrite customer
 * data today with no trail at all — support editing names and dates on
 * invitations already in three hundred hands, a design deletion repointing
 * every live event onto another one — and each of those becomes one line once
 * this exists.
 *
 * Two rules it enforces by shape:
 *
 * 1. It takes a transaction client, never `prisma`. A log written outside the
 *    transaction that changed the data is a log that can disagree with it —
 *    the same rule `CheckInLog` follows at the door.
 * 2. The actor's NAME goes into `meta`, not just the id. `AuditLog.actor` is
 *    an optional relation with no `onDelete`, so Prisma defaults it to
 *    SetNull: the day an employee's account is removed, every grant they ever
 *    issued forgets who made it. The id stays for joining; the name stays for
 *    reading.
 */
export interface AuditActor {
  id: string;
  name: string;
  role: string;
}

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  entry: {
    actor: AuditActor;
    /** Dotted and past-tense, e.g. `event.extra_invitations.granted`. */
    action: string;
    entityType: string;
    entityId: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actor.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      meta: {
        ...(entry.meta ?? {}),
        actorName: entry.actor.name,
        actorRole: entry.actor.role,
      } as Prisma.InputJsonValue,
    },
  });
}

/** The newest entries for one entity — the reader side, so a grant is not invisible. */
export async function listAuditLog(entityType: string, entityId: string, take = 20) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, action: true, meta: true, createdAt: true, actorId: true },
  });
}
