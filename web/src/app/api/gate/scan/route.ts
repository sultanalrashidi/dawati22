import { NextResponse } from "next/server";
import { resolveDoorAccess } from "@/lib/checkin/door";
import { performCheckIn } from "@/lib/checkin/service";

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

  const access = await resolveDoorAccess(eventId);
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json(await performCheckIn(qrToken.trim(), eventId, access.gateStaffId));
}
