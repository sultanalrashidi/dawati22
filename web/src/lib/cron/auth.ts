import "server-only";
import { logger } from "@/lib/logger";

/**
 * Authenticates a scheduled job.
 *
 * A cron endpoint is a public URL — the scheduler reaches it over the open
 * internet like anyone else — so the shared secret is the whole of its
 * protection. Compared in constant time, mirroring `verifyMoyasarWebhookSecret`.
 *
 * Both failure modes are logged, because the LIKELIER one here is not an
 * attacker: it is the secret being unset, mistyped or rotated in the hosting
 * dashboard, which produces a job that silently never runs. A sweep that stops
 * running looks exactly like a sweep with nothing to do.
 */
export function verifyCronSecret(authorization: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    logger.error("cron.unconfigured", { reason: "CRON_SECRET is not set" });
    return false;
  }
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!supplied || supplied.length !== expected.length) {
    logger.warn("cron.unauthorized");
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) logger.warn("cron.unauthorized");
  return diff === 0;
}
