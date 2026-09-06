import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getGateSessionEventId } from "@/lib/gatepin/session";
import { assertGateAccess, performCheckIn, CheckInAccessError } from "@/lib/checkin/service";
import { Role } from "@/generated/prisma/client";

/**
 * One scan, for both doors.
 *
 * A route handler rather than a Server Action, for the same reason the send
 * queue's write is one — and here the reason is sharper. A server action whose
 * POST never lands does not reject the promise its caller awaited: the failure
 * escapes as an uncaught window error that no try/catch and no React error
 * boundary can hold. Verified in a browser by blocking the action's request:
 * `Uncaught TypeError: Failed to fetch`, and a scanner left with the camera
 * off, its busy flag stuck, and every later scan silently swallowed. A wedding
 * hall's wifi is the one network in this product we should assume drops, so
 * the door owns its own fetch and its own failure.
 *
 * Authorisation is the union of the two ways a door can be staffed, in the
 * order they actually occur: the customer's own organisers holding a shared
 * PIN (no account, no GateStaff row — hence a null `gateStaffId` on the log),
 * and assigned gate staff signed in with an account. Both cookies are
 * SameSite=Lax, so a cross-site POST arrives without either and gets 403.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { eventId, qrToken } = (body ?? {}) as { eventId?: unknown; qrToken?: unknown };
  if (typeof eventId !== "string" || !eventId || typeof qrToken !== "string" || !qrToken.trim()) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // The PIN door first: it is the common case, and it is the only one that
  // does not need a user lookup.
  const sessionEventId = await getGateSessionEventId();
  if (sessionEventId === eventId) {
    return NextResponse.json(await performCheckIn(qrToken.trim(), eventId, null));
  }

  const user = await getSessionUser();
  if (!user || (user.role !== Role.GATE_STAFF && user.role !== Role.ADMIN)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let gateStaffId: string | null;
  try {
    gateStaffId = await assertGateAccess(user.id, user.role, eventId);
  } catch (err) {
    if (err instanceof CheckInAccessError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw err;
  }

  return NextResponse.json(await performCheckIn(qrToken.trim(), eventId, gateStaffId));
}
