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

/**
 * The fields that describe ONE couple. Everything else on an invitation is
 * shared, but these six change per pair — so anything printing them has to
 * decide what a joint wedding means, rather than silently showing the first
 * couple and dropping the rest.
 */
export const COUPLE_FIELDS = [
  "groomName",
  "brideName",
  "groomFirstName",
  "brideFirstName",
  "groomNameEn",
  "brideNameEn",
] as const;
export type CoupleField = (typeof COUPLE_FIELDS)[number];

const COUPLE_FIELD_SET: ReadonlySet<string> = new Set(COUPLE_FIELDS);

export function isCoupleField(field: string): field is CoupleField {
  return COUPLE_FIELD_SET.has(field);
}

export type ResolvedContent = Record<ContentField, string> & {
  /**
   * One entry per couple, in order. The flat couple fields above stay pinned
   * to the primary pair — the seal monogram and the link preview genuinely
   * want one name — while anything that should list the whole wedding reads
   * this instead.
   */
  perCouple: Record<CoupleField, string>[];
};

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

/** The six couple-scoped fields for a single pair. */
function coupleFields(couple: CoupleInput): Record<CoupleField, string> {
  return {
    groomName: joinName(couple.groomNameAr, couple.groomFamilyAr, couple.groomNameEn),
    brideName: joinName(couple.brideNameAr, couple.brideFamilyAr, couple.brideNameEn),
    groomFirstName: couple.groomNameAr?.trim() || couple.groomNameEn,
    brideFirstName: couple.brideNameAr?.trim() || couple.brideNameEn,
    groomNameEn: couple.groomNameEn,
    brideNameEn: couple.brideNameEn,
  };
}

export function resolveContent(input: InvitationContentInput): ResolvedContent {
  const date = new Date(input.eventDate);
  const primary = input.couples[0] ?? EMPTY_COUPLE;
  const groom = joinName(primary.groomNameAr, primary.groomFamilyAr, primary.groomNameEn);
  const bride = joinName(primary.brideNameAr, primary.brideFamilyAr, primary.brideNameEn);
  const perCouple = (input.couples.length > 0 ? input.couples : [EMPTY_COUPLE]).map(coupleFields);

  return {
    perCouple,
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

/**
 * Substitute `{field}` placeholders in a static text layer's copy.
 *
 * A template that names couple fields — the entry-pass card's
 * "{brideFirstName} & {groomFirstName}", for instance — is rendered ONCE PER
 * COUPLE and joined with newlines. A joint wedding otherwise printed only the
 * first pair on the pass and quietly dropped the others. With a single couple
 * the output is identical to a plain substitution, so nothing else moves.
 */
export function interpolate(text: string, content: ResolvedContent): string {
  const fill = (source: Record<string, unknown>) =>
    text.replace(/\{(\w+)\}/g, (match, key: string) => {
      const value = source[key];
      return typeof value === "string" ? value : match;
    });

  const keys = [...text.matchAll(/\{(\w+)\}/g)].map(([, key]) => key);
  if (content.perCouple.length > 1 && keys.some(isCoupleField)) {
    return content.perCouple.map((couple) => fill({ ...content, ...couple })).join("\n");
  }
  return fill(content);
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
