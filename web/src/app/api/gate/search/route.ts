import { NextResponse } from "next/server";
import { resolveDoorAccess } from "@/lib/checkin/door";
import { searchGuestsAtDoor } from "@/lib/checkin/service";

/**
 * Find a guest by name or number when her code will not scan.
 *
 * POST, not GET: the query is a guest's name or her phone number, and those do
 * not belong in a URL that lands in access logs and browser history.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { eventId, query } = (body ?? {}) as { eventId?: unknown; query?: unknown };
  if (typeof eventId !== "string" || !eventId || typeof query !== "string") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const access = await resolveDoorAccess(eventId);
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json({ guests: await searchGuestsAtDoor(eventId, query) });
}
