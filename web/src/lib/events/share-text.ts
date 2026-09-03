/**
 * The invitation sentence as ONE readable line, for places that cannot render
 * the card: the WhatsApp message a host sends, the ICS calendar DESCRIPTION,
 * the hand-coded pass cards' `invitationTextAr` prop.
 *
 * Pure and dependency-free on purpose — it is imported from server components,
 * route handlers and client components alike, so it must not pull in the
 * Prisma client (`@/lib/events/service` is `server-only`).
 */

import {
  composeHostLine,
  coupleLineFor,
  INVITE_VERB,
  type CoupleInput,
  type InvitationTextFields,
} from "@/lib/themes/builder/content";

/**
 * Anything shaped enough to write the invitation line: the wording columns,
 * the singular couple columns Event has always carried, and (optionally) the
 * EventCouple rows. Every wording field is optional so a query that selected
 * only the legacy columns still compiles — it then gets a host-less line.
 */
export interface ShareTextSource extends Partial<InvitationTextFields> {
  invitationTextAr?: string | null;
  groomNameEn: string;
  brideNameEn: string;
  groomNameAr: string | null;
  groomFamilyAr: string | null;
  brideNameAr: string | null;
  brideFamilyAr: string | null;
  couples?: readonly (CoupleInput & { sortOrder?: number })[] | null;
}

/**
 * The event's couples, ordered and never empty — the same rule as
 * `couplesFor` in the (server-only) event service, restated here so this file
 * stays importable from the client.
 */
function couplesOf(event: ShareTextSource): CoupleInput[] {
  const rows = event.couples ?? [];
  if (rows.length > 0) {
    return [...rows]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((couple) => ({
        groomNameEn: couple.groomNameEn,
        brideNameEn: couple.brideNameEn,
        groomNameAr: couple.groomNameAr,
        groomFamilyAr: couple.groomFamilyAr,
        brideNameAr: couple.brideNameAr,
        brideFamilyAr: couple.brideFamilyAr,
      }));
  }
  return [
    {
      groomNameEn: event.groomNameEn,
      brideNameEn: event.brideNameEn,
      groomNameAr: event.groomNameAr,
      groomFamilyAr: event.groomFamilyAr,
      brideNameAr: event.brideNameAr,
      brideFamilyAr: event.brideFamilyAr,
    },
  ];
}

/** Collapse any line breaks and runs of spaces into single spaces. */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The composed invitation sentence on one line, e.g.
 * "تتشرف والدة العريس أم عبدالله ووالدة العروس أم سعد بدعوتكم لحضور حفل زفاف فيصل على نورة".
 * A joint wedding lists its couples separated by "،".
 */
export function composedShareLine(event: ShareTextSource): string {
  const couples = couplesOf(event)
    .map((couple) => flatten(coupleLineFor(couple, event.coupleFormat)))
    .filter(Boolean)
    .join("، ");
  return [flatten(composeHostLine(event)), INVITE_VERB, couples].filter(Boolean).join(" ");
}

/**
 * What to say for this event in plain text: the host's own extra text when
 * she wrote one, otherwise the composed invitation sentence.
 */
export function invitationShareText(event: ShareTextSource): string {
  const own = event.invitationTextAr?.trim();
  return own ? own : composedShareLine(event);
}
