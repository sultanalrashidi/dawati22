/**
 * Design/data separation: the layout document says *where* a field prints, this
 * says *what* it prints. Nothing here is baked into an image, so one design
 * serves every couple.
 */

import type { ContentField } from "@/lib/themes/builder/types";

/**
 * One groom+bride pair. An event carries an ordered list of these — a joint
 * wedding announces more than one couple on the same invitation — with the
 * first treated as primary wherever a single name is needed (the seal
 * monogram, the link preview, the `groomName`/`brideName` fields).
 */
export interface CoupleInput {
  groomNameEn: string;
  brideNameEn: string;
  groomNameAr: string | null;
  groomFamilyAr: string | null;
  brideNameAr: string | null;
  brideFamilyAr: string | null;
}

export interface InvitationContentInput {
  guestName: string;
  /** Never empty — callers synthesise a single entry from the legacy columns. */
  couples: CoupleInput[];
  familiesGreetingAr: string | null;
  invitationTextAr: string;
  /** ISO string — formatted here so server and client agree. */
  eventDate: string;
  locationName: string;
  regionName: string | null;
}

export type ResolvedContent = Record<ContentField, string>;

const DATE_FORMATTER = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("ar-SA", {
  hour: "numeric",
  minute: "2-digit",
});

const EMPTY_COUPLE: CoupleInput = {
  groomNameEn: "",
  brideNameEn: "",
  groomNameAr: null,
  groomFamilyAr: null,
  brideNameAr: null,
  brideFamilyAr: null,
};

function joinName(first: string | null, family: string | null, fallback: string): string {
  const parts = [first, family].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length > 0 ? parts.join(" ") : fallback;
}

/** "فيصل العتيبي و نورة القحطاني" for one pair. */
export function coupleLabel(couple: CoupleInput): string {
  const groom = joinName(couple.groomNameAr, couple.groomFamilyAr, couple.groomNameEn);
  const bride = joinName(couple.brideNameAr, couple.brideFamilyAr, couple.brideNameEn);
  return `${groom} و ${bride}`;
}

export function resolveContent(input: InvitationContentInput): ResolvedContent {
  const date = new Date(input.eventDate);
  const primary = input.couples[0] ?? EMPTY_COUPLE;
  const groom = joinName(primary.groomNameAr, primary.groomFamilyAr, primary.groomNameEn);
  const bride = joinName(primary.brideNameAr, primary.brideFamilyAr, primary.brideNameEn);

  return {
    guestName: input.guestName,
    groomName: groom,
    brideName: bride,
    // One pair per line, so a text layer holding this field grows down the
    // card for a joint wedding instead of running off its edges.
    coupleNames: input.couples.map(coupleLabel).join("\n"),
    // Given name only. The hand-coded pass card prints the couple without
    // family names, so reproducing one needs a field that stops at the first
    // name rather than the joined "name + family" above.
    groomFirstName: primary.groomNameAr?.trim() || primary.groomNameEn,
    brideFirstName: primary.brideNameAr?.trim() || primary.brideNameEn,
    groomNameEn: primary.groomNameEn,
    brideNameEn: primary.brideNameEn,
    hostName: input.familiesGreetingAr ?? "",
    eventDate: DATE_FORMATTER.format(date),
    // The long form leads with the weekday; the compact one drops it, which is
    // what the hand-coded entry pass shows in its narrow date column.
    eventDateShort: SHORT_DATE_FORMATTER.format(date),
    eventTime: TIME_FORMATTER.format(date),
    locationName: input.locationName,
    locationFull: input.regionName ? `${input.locationName} — ${input.regionName}` : input.locationName,
    regionName: input.regionName ?? "",
    invitationText: input.invitationTextAr,
    greeting: input.familiesGreetingAr ?? "",
  };
}

/** Substitute `{field}` placeholders in a static text layer's copy. */
export function interpolate(text: string, content: ResolvedContent): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in content ? content[key as ContentField] : match,
  );
}

/**
 * The couple's initials for a seal layer, e.g. "F & N".
 *
 * `maxChars` caps each side, not the whole string — an admin setting 1 wants
 * single letters, and capping the joined result would instead swallow the
 * separator and the second initial.
 */
export function initialsFor(
  content: ResolvedContent,
  separator: string,
  maxChars: number,
  script: "latin" | "arabic" = "latin",
  order: "groom-first" | "bride-first" = "groom-first",
): string {
  const groom = script === "latin" ? content.groomNameEn : content.groomName;
  const bride = script === "latin" ? content.brideNameEn : content.brideName;
  const cap = Math.max(1, maxChars);
  const initial = (name: string) => [...name.trim()].slice(0, cap).join("");
  const pair = order === "bride-first" ? [bride, groom] : [groom, bride];
  return pair.map(initial).filter(Boolean).join(` ${separator} `);
}

/** Stand-in values so the editor and gallery preview look like a real invitation. */
export const SAMPLE_CONTENT_INPUT: InvitationContentInput = {
  guestName: "أم عبدالله",
  couples: [
    {
      groomNameEn: "Faisal",
      brideNameEn: "Noura",
      groomNameAr: "فيصل",
      groomFamilyAr: "العتيبي",
      brideNameAr: "نورة",
      brideFamilyAr: "القحطاني",
    },
  ],
  familiesGreetingAr: "يسرّ عائلتي العتيبي والقحطاني دعوتكم",
  invitationTextAr: "يسعدنا حضوركم ومشاركتنا هذه الفرحة",
  eventDate: "2026-11-20T20:00:00.000Z",
  locationName: "قاعة الماسة",
  regionName: "الرياض",
};
