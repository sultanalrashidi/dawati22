/**
 * Design/data separation: the layout document says *where* a field prints, this
 * says *what* it prints. Nothing here is baked into an image, so one design
 * serves every couple.
 *
 * Everything in this file is pure and framework-free: it runs in the guest
 * page (server), the builder editor (client), the WhatsApp/ICS share texts and
 * the OG image alike. The long Arabic strings — the verse, the dua, the
 * standard note lines, the closing presets — live HERE as constants rather
 * than in the i18n dictionaries: they are invitation content, not UI copy,
 * and the same words print whichever language the host's dashboard is in.
 */

import type { ContentField } from "@/lib/themes/builder/types";

/**
 * One groom+bride pair. An event carries an ordered list of these — a joint
 * wedding announces more than one couple on the same invitation — with the
 * first treated as primary wherever a single name is needed (the seal
 * monogram, the link preview, the `groomName`/`brideName` fields).
 *
 * The English names are OPTIONAL: "" means "not given", and the Arabic given
 * name stands in wherever a Latin one was expected.
 */
export interface CoupleInput {
  groomNameEn: string;
  brideNameEn: string;
  groomNameAr: string | null;
  groomFamilyAr: string | null;
  brideNameAr: string | null;
  brideFamilyAr: string | null;
}

// ---------------------------------------------------------------------------
// The women's-section wording model
// ---------------------------------------------------------------------------

/** Mirrors the Prisma `InvitationOpening` enum, as plain string literals. */
export type InvitationOpeningKind = "VERSE" | "DUA" | "BASMALA" | "NONE";
export const INVITATION_OPENING_KINDS: readonly InvitationOpeningKind[] = ["VERSE", "DUA", "BASMALA", "NONE"];

/** Mirrors the Prisma `HostMode` enum. */
export type HostModeKind = "TEMPLATE" | "FREE";
export const HOST_MODE_KINDS: readonly HostModeKind[] = ["TEMPLATE", "FREE"];

/** Mirrors the Prisma `CoupleFormat` enum. */
export type CoupleFormatKind = "ALA" | "WAW" | "BRIDE_FOCUS";
export const COUPLE_FORMAT_KINDS: readonly CoupleFormatKind[] = ["ALA", "WAW", "BRIDE_FOCUS"];

/**
 * The event-level columns that drive the composed invitation text. Shaped
 * exactly like the Prisma `Event` columns of the same names so an event row
 * (or a form's parsed values) is assignable without renaming anything.
 */
export interface InvitationTextFields {
  openingKind: InvitationOpeningKind;
  hostMode: HostModeKind;
  /** Kunya of the groom's mother, e.g. "أم عبدالله" — used when hostMode is TEMPLATE. */
  groomMotherAr: string | null;
  /** Kunya of the bride's mother, e.g. "أم سعد" — used when hostMode is TEMPLATE. */
  brideMotherAr: string | null;
  /** The whole host line, printed verbatim — used when hostMode is FREE. */
  hostLineAr: string | null;
  coupleFormat: CoupleFormatKind;
  /** The closing line; null/empty falls back to `DEFAULT_CLOSING`. */
  closingAr: string | null;
}

/** The three standard-note switches on an event. */
export interface StandardNoteFlags {
  noteNoPhotos?: boolean | null;
  noteNoChildren?: boolean | null;
  noteShowPass?: boolean | null;
}

export const DEFAULT_OPENING_KIND: InvitationOpeningKind = "VERSE";
export const DEFAULT_HOST_MODE: HostModeKind = "TEMPLATE";
export const DEFAULT_COUPLE_FORMAT: CoupleFormatKind = "ALA";

export const BASMALA = "بسم الله الرحمن الرحيم";
export const OPENING_VERSE =
  "﴿وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً﴾";
export const OPENING_DUA = "بارك الله لهما وبارك عليهما وجمع بينهما في خير";

/** The host line's fixed parts: "تتشرف والدة العريس {أم عبدالله} ووالدة العروس {أم سعد}". */
export const HOST_LINE_LEAD = "تتشرف";
export const HOST_LINE_GROOM_MOTHER = "والدة العريس";
export const HOST_LINE_BRIDE_MOTHER = "والدة العروس";

/** The connector between the host line and the couple line. */
export const INVITE_VERB = "بدعوتكم لحضور حفل زفاف";
/** Printed after the couple line, before the date. */
export const INSHALLAH = "وذلك بمشيئة الله تعالى";

export const CLOSING_PRESETS = ["بحضوركم تكتمل فرحتنا", "دعواتكم لهما بالتوفيق", "نسعد بحضوركم"] as const;
export type ClosingPreset = (typeof CLOSING_PRESETS)[number];
export const DEFAULT_CLOSING: ClosingPreset = CLOSING_PRESETS[0];

/**
 * The track every invitation opens with unless the customer picks her own.
 *
 * It starts on the guest's tap that opens the envelope — never on page load,
 * which every mobile browser silently refuses (see background-music.tsx). That
 * tap is a real user gesture, so the sound actually plays, and it begins with
 * the reveal rather than over a closed envelope.
 */
export const DEFAULT_MUSIC_YOUTUBE_ID = "LDnUX_mwx2Q";

export const NOTE_NO_PHOTOS = "نرجو عدم التصوير حفاظاً على خصوصية الحفل";
export const NOTE_NO_CHILDREN = "يرجى عدم اصطحاب الأطفال";
export const NOTE_SHOW_PASS = "الدعوة شخصية — يرجى إبراز رمز الدعوة عند الدخول";

export interface InvitationContentInput extends Partial<InvitationTextFields> {
  guestName: string;
  /** Never empty — callers synthesise a single entry from the legacy columns. */
  couples: CoupleInput[];
  /** Legacy — no longer written by the form. Still printed by the `greeting` field. */
  familiesGreetingAr: string | null;
  /** Optional extra text under the composed invitation line. */
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

// The full date prints as TWO lines — Hijri (Umm al-Qura) leading with the
// weekday, Gregorian under it — because a Saudi invitation that shows only the
// Gregorian date reads as unfinished. Two lines rather than one long
// "الموافق…" string, so each line stays no wider than the old single-line date
// and existing layouts don't overflow sideways; text layers render `\n` as a
// line break, the same way `coupleNames` grows down the card.
const HIJRI_DATE_FORMATTER = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
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

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function joinName(first: string | null, family: string | null, fallback: string): string {
  const parts = [first, family].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length > 0 ? parts.join(" ") : fallback;
}

/** Given name only — Arabic first, English when the Arabic is missing. */
function groomGivenName(couple: CoupleInput): string {
  return clean(couple.groomNameAr) || couple.groomNameEn;
}

function brideGivenName(couple: CoupleInput): string {
  return clean(couple.brideNameAr) || couple.brideNameEn;
}

/**
 * "فيصل العتيبي و نورة القحطاني" for one pair — GROOM FIRST, everywhere the
 * two are printed together.
 */
export function coupleLabel(couple: CoupleInput): string {
  const groom = joinName(couple.groomNameAr, couple.groomFamilyAr, couple.groomNameEn);
  const bride = joinName(couple.brideNameAr, couple.brideFamilyAr, couple.brideNameEn);
  return `${groom} و ${bride}`;
}

// ---------------------------------------------------------------------------
// Composition helpers — shared by the renderer, the share texts and the form
// ---------------------------------------------------------------------------

/**
 * The opening (الافتتاحية) for a kind. VERSE and DUA both lead with the
 * basmala on its own line; NONE prints nothing.
 */
export function openingText(kind: InvitationOpeningKind | null | undefined): string {
  switch (kind ?? DEFAULT_OPENING_KIND) {
    case "VERSE":
      return `${BASMALA}\n${OPENING_VERSE}`;
    case "DUA":
      return `${BASMALA}\n${OPENING_DUA}`;
    case "BASMALA":
      return BASMALA;
    case "NONE":
      return "";
  }
}

/**
 * The host line (سطر الداعي).
 *
 * TEMPLATE composes "تتشرف والدة العريس أم عبدالله ووالدة العروس أم سعد" from
 * the two mothers' kunyas; a missing mother drops her half rather than
 * printing "والدة العريس" over a blank. FREE prints `hostLineAr` verbatim.
 * Either way an event with none of it set yields "" — the form makes the
 * fields required, so that only happens for events created before them.
 */
export function composeHostLine(
  input: Pick<Partial<InvitationTextFields>, "hostMode" | "groomMotherAr" | "brideMotherAr" | "hostLineAr">,
): string {
  const mode = input.hostMode ?? DEFAULT_HOST_MODE;
  if (mode === "FREE") return clean(input.hostLineAr);

  const groomMother = clean(input.groomMotherAr);
  const brideMother = clean(input.brideMotherAr);
  const halves = [
    groomMother ? `${HOST_LINE_GROOM_MOTHER} ${groomMother}` : "",
    brideMother ? `${HOST_LINE_BRIDE_MOTHER} ${brideMother}` : "",
  ].filter(Boolean);
  // Neither mother named yet — which is now the normal state of a draft, since
  // the kunyas are no longer asked for before the invitation can be seen.
  // Printing the ROLES alone still yields a complete, correct Arabic sentence
  // ("تتشرف والدة العريس ووالدة العروس بدعوتكم…"), where returning "" would
  // leave the invitation opening with a verb that has no subject.
  if (halves.length === 0) {
    return `${HOST_LINE_LEAD} ${HOST_LINE_GROOM_MOTHER} و${HOST_LINE_BRIDE_MOTHER}`;
  }
  return `${HOST_LINE_LEAD} ${halves.join(" و")}`;
}

/**
 * ONE couple's names in the chosen format, groom first:
 *   ALA → "فيصل على نورة"   WAW → "فيصل و نورة"   BRIDE_FOCUS → "فيصل\nعلى نورة"
 * Given names only (Arabic, else English). A pair with only one name filled
 * in prints that name alone instead of a dangling connector.
 */
export function coupleLineFor(couple: CoupleInput, format: CoupleFormatKind | null | undefined): string {
  const bride = brideGivenName(couple);
  const groom = groomGivenName(couple);
  if (!bride || !groom) return bride || groom;
  switch (format ?? DEFAULT_COUPLE_FORMAT) {
    case "ALA":
      return `${groom} على ${bride}`;
    case "WAW":
      return `${groom} و ${bride}`;
    case "BRIDE_FOCUS":
      return `${groom}\nعلى ${bride}`;
  }
}

/** The couple line (سطر العروسين): one line per couple for a joint wedding. */
export function composeCoupleLine(
  input: Pick<InvitationContentInput, "couples"> & Pick<Partial<InvitationTextFields>, "coupleFormat">,
): string {
  return input.couples
    .map((couple) => coupleLineFor(couple, input.coupleFormat))
    .filter(Boolean)
    .join("\n");
}

/**
 * The whole invitation sentence: host line, the fixed verb, the couple line —
 * one per line. An empty host line (legacy event) is skipped rather than left
 * as a blank first line.
 */
export function composeInviteLine(
  input: Pick<InvitationContentInput, "couples"> &
    Pick<Partial<InvitationTextFields>, "hostMode" | "groomMotherAr" | "brideMotherAr" | "hostLineAr" | "coupleFormat">,
): string {
  return [composeHostLine(input), INVITE_VERB, composeCoupleLine(input)].filter(Boolean).join("\n");
}

/** The closing line, with the default preset standing in for an unset one. */
export function closingText(closingAr: string | null | undefined): string {
  return clean(closingAr) || DEFAULT_CLOSING;
}

/**
 * The standard note lines the host switched on, in the order they print:
 * photos, children, entry pass. They go BEFORE the free-text notes.
 */
export function standardNoteLines(flags: StandardNoteFlags | null | undefined): string[] {
  if (!flags) return [];
  const lines: string[] = [];
  if (flags.noteNoPhotos) lines.push(NOTE_NO_PHOTOS);
  if (flags.noteNoChildren) lines.push(NOTE_NO_CHILDREN);
  if (flags.noteShowPass) lines.push(NOTE_SHOW_PASS);
  return lines;
}

/** Standard lines followed by the host's own `notesAr` lines (one per line, blanks dropped). */
export function noteLines(flags: StandardNoteFlags | null | undefined, notesAr: string | null | undefined): string[] {
  const free = (notesAr ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return [...standardNoteLines(flags), ...free];
}

/** The six couple-scoped fields for a single pair. */
function coupleFields(couple: CoupleInput): Record<CoupleField, string> {
  return {
    groomName: joinName(couple.groomNameAr, couple.groomFamilyAr, couple.groomNameEn),
    brideName: joinName(couple.brideNameAr, couple.brideFamilyAr, couple.brideNameEn),
    groomFirstName: groomGivenName(couple),
    brideFirstName: brideGivenName(couple),
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
  const hostLine = composeHostLine(input);
  const coupleLine = composeCoupleLine(input);

  return {
    perCouple,
    guestName: input.guestName,
    groomName: groom,
    brideName: bride,
    // One pair per line, groom first, so a text layer holding this field grows
    // down the card for a joint wedding instead of running off its edges.
    coupleNames: input.couples.map(coupleLabel).join("\n"),
    // Given name only. The hand-coded pass card prints the couple without
    // family names, so reproducing one needs a field that stops at the first
    // name rather than the joined "name + family" above.
    groomFirstName: groomGivenName(primary),
    brideFirstName: brideGivenName(primary),
    groomNameEn: primary.groomNameEn,
    brideNameEn: primary.brideNameEn,
    // "اسم الداعي" is the composed host line — the two mothers, or the free
    // line. It used to echo the legacy families greeting.
    hostName: hostLine,
    // "هـ" comes from Intl for the Islamic calendar; "م" is appended by hand
    // because Intl leaves the Gregorian year bare, and next to a Hijri line
    // the pair of era marks is what makes each calendar unmistakable.
    eventDate: `${HIJRI_DATE_FORMATTER.format(date)}\n${SHORT_DATE_FORMATTER.format(date)} م`,
    // The full form leads with the weekday and carries both calendars; the
    // compact one is Gregorian only and stays that way — it fills the
    // hand-coded entry pass's narrow date column, where two lines don't fit.
    eventDateShort: SHORT_DATE_FORMATTER.format(date),
    eventTime: TIME_FORMATTER.format(date),
    locationName: input.locationName,
    locationFull: input.regionName ? `${input.locationName} — ${input.regionName}` : input.locationName,
    regionName: input.regionName ?? "",
    invitationText: input.invitationTextAr,
    greeting: input.familiesGreetingAr ?? "",
    opening: openingText(input.openingKind),
    hostLine,
    inviteVerb: INVITE_VERB,
    coupleLine,
    inviteLine: [hostLine, INVITE_VERB, coupleLine].filter(Boolean).join("\n"),
    inshallah: INSHALLAH,
    closing: closingText(input.closingAr),
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
 *
 * The English names are optional, so a Latin-script seal falls back to the
 * Arabic name's first letter rather than printing a lone separator.
 */
export function initialsFor(
  content: ResolvedContent,
  separator: string,
  maxChars: number,
  script: "latin" | "arabic" = "latin",
  order: "groom-first" | "bride-first" = "groom-first",
): string {
  const groom = script === "latin" ? content.groomNameEn.trim() || content.groomName : content.groomName;
  const bride = script === "latin" ? content.brideNameEn.trim() || content.brideName : content.brideName;
  const cap = Math.max(1, maxChars);
  const initial = (name: string) => [...name.trim()].slice(0, cap).join("");
  const pair = order === "bride-first" ? [bride, groom] : [groom, bride];
  return pair.map(initial).filter(Boolean).join(` ${separator} `);
}

/** Stand-in values so the editor and gallery preview look like a real invitation. */
export const SAMPLE_CONTENT_INPUT: InvitationContentInput = {
  // Not one of the sample mothers below: the host must not be seen inviting herself.
  guestName: "أم فهد",
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
  openingKind: "VERSE",
  hostMode: "TEMPLATE",
  groomMotherAr: "أم عبدالله",
  brideMotherAr: "أم سعد",
  hostLineAr: null,
  coupleFormat: "ALA",
  closingAr: "بحضوركم تكتمل فرحتنا",
  familiesGreetingAr: "يسرّ عائلتي العتيبي والقحطاني دعوتكم",
  // The composed invite line replaces the old free text; this is the optional extra.
  invitationTextAr: "",
  eventDate: "2026-11-20T20:00:00.000Z",
  locationName: "قاعة الماسة",
  regionName: "الرياض",
};
