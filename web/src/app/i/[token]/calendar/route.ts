import { NextResponse } from "next/server";
import { getInvitationByLinkToken } from "@/lib/invitations/service";

/** Escapes text per RFC 5545 §3.3.11 — commas, semicolons, backslashes, newlines. */
function escapeIcsText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toUtcStamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

const DURATION_MINUTES = 180;

/**
 * A real .ics file (not a Google Calendar web link) — iPhone Safari opens
 * this directly in the native Calendar app with the event pre-filled,
 * which a web link can't do.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByLinkToken(token);
  if (!invitation) return new NextResponse("Not found", { status: 404 });

  const { event } = invitation;
  const start = new Date(event.eventDate);
  const end = new Date(start.getTime() + DURATION_MINUTES * 60_000);
  const location = event.regionName ? `${event.locationName} — ${event.regionName}` : event.locationName;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dawati//Invitation//AR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${invitation.id}@dawati`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeIcsText(event.name)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(event.invitationTextAr)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invitation.ics"',
    },
  });
}
