import { couplesFor } from "@/lib/events/service";
import type { getViewableInvitationByLinkToken } from "@/lib/invitations/service";
import { coupleLineFor, resolveContent } from "@/lib/themes/builder/content";

type ViewableInvitation = NonNullable<Awaited<ReturnType<typeof getViewableInvitationByLinkToken>>>;

/**
 * What a shared invitation link says about itself before it is opened: the
 * couple and the date. Both halves of the WhatsApp card read it — the page's
 * description (`generateMetadata`) and the image (opengraph-image.tsx) — so
 * the two never disagree.
 *
 * Arabic throughout, because the invitation behind the link always is (see
 * app/i/[token]/layout.tsx). The preview used to prefer the English names
 * whenever both were given, so an Arabic invitation went out as
 * "Faisal و Noura", on a card dated in English. Nothing is formatted here:
 * the names come from `coupleLineFor` and the date from `resolveContent`, the
 * helpers the invitation itself prints them with (the date as every BUILDER
 * design shows it).
 */
export function linkPreviewText(invitation: ViewableInvitation): { names: string; dateLines: string[] } {
  const couples = couplesFor(invitation.event);
  // A joint wedding still gets one preview line: the primary couple, same as
  // the seal monogram. Given names, Arabic first and English only where the
  // Arabic one is missing; groom first, joined with "و".
  const names = coupleLineFor(couples[0], "WAW");
  // The invitation's own date: Hijri (Umm al-Qura) with the weekday, then the
  // Gregorian date marked "م" — one entry per line, as the card prints it.
  const { eventDate } = resolveContent({
    ...invitation.event,
    guestName: invitation.guest.nameAr,
    couples,
    eventDate: invitation.event.eventDate.toISOString(),
  });
  return { names, dateLines: eventDate.split("\n") };
}
