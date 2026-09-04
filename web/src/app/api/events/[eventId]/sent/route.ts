import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/client";
import { markInvitationsShared, GuestError } from "@/lib/guests/service";

/**
 * "These invitations went out" — the send queue's only write.
 *
 * A plain route handler rather than a Server Action because of when it is
 * called: the moment the host comes BACK from WhatsApp. Actions are dispatched
 * through the app router's own queue, which serializes and can still be
 * waiting when a phone suspends the tab; a fetch is issued immediately and its
 * result is a plain response this screen can act on.
 *
 * Idempotent all the way down — `markInvitationsShared` filters on
 * `sentAt: null` — so a client that retries after a lost response re-sends the
 * same ids and changes nothing.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/events/[eventId]/sent">) {
  const { eventId } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== Role.CUSTOMER) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let guestIds: unknown;
  try {
    ({ guestIds } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!Array.isArray(guestIds)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const ids = guestIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return NextResponse.json({ marked: 0, ids: [] });

  try {
    await markInvitationsShared(eventId, ids, user.id);
  } catch (err) {
    if (err instanceof GuestError) return NextResponse.json({ error: "refused" }, { status: 403 });
    throw err;
  }

  // The ids back, so the client clears exactly what the server accepted rather
  // than clearing its whole pending list on a bare 200.
  return NextResponse.json({ marked: ids.length, ids });
}
