import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Serialises every transaction that names the same `scope` + `key`, across
 * every server instance, until the calling transaction commits or rolls back.
 *
 * For "count, then insert" admission checks (sends per phone, drafts per
 * address): without it, N concurrent requests all count the same N-1 rows and
 * all insert. A process-local mutex would not help — the requests land on
 * different instances — so the lock lives in Postgres, as a transaction-scoped
 * advisory lock that can never be leaked by a crashed request.
 *
 * Keep the locked section short and free of network I/O: an SMS call made
 * while holding it would queue every other request for the same key behind it.
 */
export async function lockKey(tx: Prisma.TransactionClient, scope: string, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${scope}:${key}`}, 0))`;
}
