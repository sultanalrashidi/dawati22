import type { CoupleInput } from "@/lib/themes/builder/content";
import type { ScheduleItem } from "@/lib/events/types";
import { riyadhDateTimeLocalToDate, toRiyadhDateTimeLocal } from "@/lib/dates";
import { composeWeddingName } from "@/lib/events/event-name";

/**
 * What a draft is born holding.
 *
 * The gallery's "start with this design" used to create a row with a
 * placeholder name, an empty venue and no couple, and then ask three questions
 * before the preview was reachable. Now the row is written COMPLETE with these
 * values, so the very first thing she sees after picking a design is a
 * finished-looking invitation with every screen present — opening, host line,
 * programme, notes — and one edit page where all of it is already filled in.
 *
 * The names are deliberately plausible Saudi names rather than "العريس" /
 * "العروس": a placeholder that reads as a placeholder makes the preview look
 * unfinished, which is the thing this exists to avoid. The cost is that she
 * could forget to change them — so everything that leads to money compares
 * against THESE constants (`usesSampleNames`), and this is the one module that
 * owns them.
 *
 * Not `SAMPLE_CONTENT_INPUT` from content.ts: that one feeds the theme builder
 * and the gallery preview dialog, and it carries English names, a fixed date
 * and a `guestName`. A draft must not carry English names (a forgotten "Fahad"
 * would print an "F" on the seal of a groom called محمد), and its date has to
 * be in the future whenever it is created.
 */

export const SAMPLE_GROOM_GIVEN = "فهد";
export const SAMPLE_GROOM_FAMILY = "آل سعد";
export const SAMPLE_BRIDE_GIVEN = "نورة";
export const SAMPLE_BRIDE_FAMILY = "آل خالد";

export const SAMPLE_COUPLE: CoupleInput = {
  // Empty on purpose — see the module comment. The seal falls back to the
  // Arabic initials.
  groomNameEn: "",
  brideNameEn: "",
  groomNameAr: SAMPLE_GROOM_GIVEN,
  groomFamilyAr: SAMPLE_GROOM_FAMILY,
  brideNameAr: SAMPLE_BRIDE_GIVEN,
  brideFamilyAr: SAMPLE_BRIDE_FAMILY,
};

/**
 * The mothers' kunyas, named after the couple so the composed host line reads
 * as one family's invitation. Neither may equal `draft.previewGuestName`
 * ("أم عبدالله") — the preview greets that guest, and a host must not be seen
 * inviting herself.
 */
export const SAMPLE_GROOM_MOTHER = "أم فهد";
export const SAMPLE_BRIDE_MOTHER = "أم نورة";

export const SAMPLE_VENUE = "قاعة الفيصلية للاحتفالات";
export const SAMPLE_REGION = "الرياض";

/**
 * The programme, in the `{labelAr, time}` shape `Event.scheduleItems` stores.
 * Neither side may contain "|" — the form edits this as `label|time` lines.
 */
export const SAMPLE_SCHEDULE: readonly ScheduleItem[] = [
  { labelAr: "استقبال الضيوف", time: "٩:٠٠ م" },
  { labelAr: "الزفة", time: "١٠:٣٠ م" },
  { labelAr: "العشاء", time: "١٢:٠٠ ص" },
];

export const SAMPLE_EVENT_NAME = composeWeddingName([SAMPLE_COUPLE]);

export const SAMPLE_DAYS_AHEAD = 60;
/** Riyadh wall-clock time of the sample wedding — weddings here start late. */
export const SAMPLE_TIME_RIYADH = "21:00";

/**
 * Sixty days from `now`, at nine in the evening RIYADH time — not the
 * server's. Going through the Riyadh helpers rather than `setHours` is what
 * keeps the invitation printing the same weekday and Hijri date on Vercel
 * (UTC) and in her browser.
 */
export function sampleEventDate(now: Date = new Date()): Date {
  const ahead = new Date(now.getTime() + SAMPLE_DAYS_AHEAD * 24 * 60 * 60 * 1000);
  const day = toRiyadhDateTimeLocal(ahead).slice(0, 10);
  const at = riyadhDateTimeLocalToDate(`${day}T${SAMPLE_TIME_RIYADH}`);
  // Only unreachable if the helpers disagree with themselves; fall back to the
  // raw instant rather than throwing inside draft creation.
  return at ?? ahead;
}

/**
 * Whether any couple on the row is still the sample pair — the check the
 * activate page and `createPerInvitationOrder` make before money moves.
 *
 * Given names only, trimmed: changing the family name alone still leaves
 * "فهد على نورة" printed on every pass. Accepts the Event row's mirrored
 * columns as well as EventCouple rows, since both carry these two fields.
 */
export function usesSampleNames(
  couples: readonly { groomNameAr: string | null; brideNameAr: string | null }[],
): boolean {
  return couples.some(
    (couple) =>
      (couple.groomNameAr ?? "").trim() === SAMPLE_GROOM_GIVEN &&
      (couple.brideNameAr ?? "").trim() === SAMPLE_BRIDE_GIVEN,
  );
}
