import { NextResponse } from "next/server";
import { resolveDoorAccess } from "@/lib/checkin/door";
import { setAdmittedCount } from "@/lib/checkin/service";

/**
 * "How many walked in?" — set the count for one guest.
 *
 * Also the way a guest found by name is let in: the search gives her id, this
 * says how many of her seats to use. An absolute number, so a tap that lands
 * twice on a bad connection cannot admit two more women.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { eventId, guestId, seats } = (body ?? {}) as {
    eventId?: unknown;
    guestId?: unknown;
    seats?: unknown;
  };
  if (
    typeof eventId !== "string" || !eventId ||
    typeof guestId !== "string" || !guestId ||
    typeof seats !== "number" || !Number.isInteger(seats) || seats < 0
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const access = await resolveDoorAccess(eventId);
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json(await setAdmittedCount(eventId, guestId, access.gateStaffId, seats));
}
