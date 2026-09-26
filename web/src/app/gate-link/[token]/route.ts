import { NextResponse, userAgent } from "next/server";
import type { NextRequest } from "next/server";
import { resolveGateLink } from "@/lib/gatepin/service";
import { createGateSession } from "@/lib/gatepin/session";

/**
 * The link the host sends her door team: one tap and the scanner is open.
 *
 * It replaces typing the reference code and PIN, not the check itself — the
 * token is 256 random bits, so the link is as hard to guess as a PIN is easy,
 * and the host can replace or switch it off from her event page, which also
 * closes every door already opened.
 *
 * A route handler because opening it has to write the door-session cookie.
 * Link previews (WhatsApp fetches the URL to draw a card) are not a door
 * team member arriving, so they get the redirect and no session.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const scanner = new URL("/ar/gate-access", request.url);

  const eventId = await resolveGateLink(token);
  if (!eventId) {
    scanner.searchParams.set("link", "invalid");
    return NextResponse.redirect(scanner);
  }

  if (!userAgent(request).isBot) await createGateSession(eventId);
  return NextResponse.redirect(scanner);
}
