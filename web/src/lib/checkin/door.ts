import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { getGateSessionEventId } from "@/lib/gatepin/session";
import { assertGateAccess, CheckInAccessError } from "@/lib/checkin/service";
import { isDoorEligible } from "@/lib/checkin/eligibility";
import { Role } from "@/generated/prisma/client";

/**
 * Who is allowed to work this door, and as whom.
 *
 * Two ways a door is staffed, and the routes all three need the same answer:
 * the customer's own organisers holding the shared PIN (no account, no
 * GateStaff row — hence `gateStaffId: null` on every log they write), and
 * assigned gate staff signed in with an account. Written once here so a new
 * door endpoint cannot quietly authorise a different set of people.
 *
 * Both cookies are SameSite=Lax, so a cross-site POST arrives without either.
 */
export type DoorAccess = { ok: true; gateStaffId: string | null } | { ok: false };

export async function resolveDoorAccess(eventId: string): Promise<DoorAccess> {
  // No door at all for an event without the QR pass, however the caller got
  // here — a PIN set before this rule existed, or an assignment.
  if (!(await isDoorEligible(eventId))) return { ok: false };

  // The PIN door first: the common case, and the only one needing no user.
  if ((await getGateSessionEventId()) === eventId) return { ok: true, gateStaffId: null };

  const user = await getSessionUser();
  if (!user || (user.role !== Role.GATE_STAFF && user.role !== Role.ADMIN)) return { ok: false };

  try {
    return { ok: true, gateStaffId: await assertGateAccess(user.id, user.role, eventId) };
  } catch (err) {
    if (err instanceof CheckInAccessError) return { ok: false };
    throw err;
  }
}
