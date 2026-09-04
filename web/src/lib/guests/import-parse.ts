import { normalizePhone, DEFAULT_PHONE_COUNTRY } from "@/lib/security/phone";

/**
 * Reading a pasted guest list.
 *
 * Dependency-free and client-safe on purpose: the review table and the server
 * action run the SAME function over the same text, so what she confirms is
 * what gets written. The array the browser posts is a convenience, never the
 * authority — the action re-parses and re-validates it.
 *
 * The shapes it has to survive are the shapes a Saudi bride's list actually
 * arrives in: a WhatsApp message, a column pasted out of Excel, a note on her
 * phone. So `أم فلان، 0501234567، 3` and `أم فلان 0501234567` and a bare
 * `أم فلان` all have to read correctly, and none of them is a CSV.
 */

export const MAX_IMPORT_LINES = 800;
export const MAX_SEATS = 20;
const MIN_NAME_LENGTH = 2;

export type RowStatus =
  | "ok"
  | "noName"
  | "nameShort"
  | "unreadableField"
  | "badPhone"
  | "dupInList"
  | "dupExisting";

export interface ParsedRow {
  /** 1-based line number in what she pasted, so the review can point at it. */
  line: number;
  raw: string;
  nameAr: string;
  /** E.164, or null when there was no number or it did not normalize. */
  phone: string | null;
  allowedCount: number;
  status: RowStatus;
}

/** Arabic-Indic and Eastern-Arabic digits, which phones and keyboards both produce. */
const DIGIT_MAP: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function toAsciiDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => DIGIT_MAP[d] ?? d);
}

/**
 * Everything that is genuinely a field separator. A single space is NOT one:
 * Arabic names contain spaces, so splitting on one would cut «أم فلان» in half.
 */
const FIELD_SEPARATORS = /\t|[,،;؛|]|\s{2,}/;

/**
 * A run of digits long enough to be a phone number, found ANYWHERE in a field.
 *
 * Within a field, because the split above has already taken tabs, commas and
 * double spaces out of the way — so the only spaces left are the ones inside
 * «+966 50 111 2255», which is one number and not three fields.
 *
 * The 9-digit floor is what stops it eating a seat count: `شيخة  0500000000  25`
 * has already been split, and a bare `25` can never reach the length of a
 * number. The 15-digit ceiling is E.164's own.
 */
const PHONE_RUN = /(?:\+|00)?\d[\d\s().\u2010-\u2015-]{6,}\d/g;

/** Digit count in the E.164 range a real number can occupy. */
function isPhoneLength(run: string): boolean {
  const digits = run.replace(/\D/g, "").length;
  return digits >= 9 && digits <= 15;
}

function peelPhone(field: string): { rest: string; phoneRaw: string | null } {
  for (const match of field.matchAll(PHONE_RUN)) {
    let run = match[0];
    if (!isPhoneLength(run)) continue;

    // The run is allowed to contain spaces so that «+966 50 111 2255» reads as
    // one number — which means on a single-space line it also swallows the
    // seat count: `أم فهد 0501234567 3` matches "0501234567 3", eleven digits,
    // inside the window. Both the phone AND the seats would be lost silently,
    // and a guest allowed five people would be created allowing one.
    //
    // So: if dropping a trailing 1-2 digit group leaves something that still
    // looks like a number AND normalizes, prefer that reading. Only when it
    // normalizes — an ambiguous short run is left alone rather than guessed at.
    const split = /^(.*\d)\s+(\d{1,2})$/.exec(run);
    if (split) {
      const head = split[1];
      const tail = Number(split[2]);
      if (
        isPhoneLength(head) &&
        tail >= 1 &&
        tail <= MAX_SEATS &&
        normalizePhone(head, DEFAULT_PHONE_COUNTRY) !== null
      ) {
        run = head;
      }
    }

    // `run.length`, not `match[0].length`: when the seat count was backed off
    // above, it has to stay in `rest` for the caller to read.
    const consumedTo = (match.index ?? 0) + run.length;
    return {
      rest: `${field.slice(0, match.index)} ${field.slice(consumedTo)}`.trim(),
      phoneRaw: run,
    };
  }
  return { rest: field, phoneRaw: null };
}

/**
 * A seat count written after the name with a single space — `عمتي هيا 5`.
 *
 * Only peeled off a field that already has a name in front of it, and only for
 * a value that could actually be a seat count, so a name is never truncated
 * into a number that was part of it.
 */
const TRAILING_SEATS = /^(.*\S)\s+(\d{1,2})$/;

function peelSeats(field: string): { rest: string; seats: number | null } {
  const match = TRAILING_SEATS.exec(field);
  if (!match) return { rest: field, seats: null };
  const value = Number(match[2]);
  if (value < 1 || value > MAX_SEATS) return { rest: field, seats: null };
  return { rest: match[1], seats: value };
}

export function parseGuestList(
  text: string,
  existing: { names: Set<string>; phones: Set<string> } = { names: new Set(), phones: new Set() },
): ParsedRow[] {
  const seenNames = new Set<string>();
  const seenPhones = new Set<string>();

  return text
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, line: index + 1 }))
    .filter(({ raw }) => raw.trim().length > 0)
    .slice(0, MAX_IMPORT_LINES)
    .map(({ raw, line }) => {
      const fields = toAsciiDigits(raw)
        .split(FIELD_SEPARATORS)
        .map((f) => f.trim())
        .filter(Boolean);

      const nameParts: string[] = [];
      let phoneRaw: string | null = null;
      let allowedCount = 1;
      let unreadable = false;

      for (const field of fields) {
        const peeled = peelPhone(field);
        if (peeled.phoneRaw && !phoneRaw) phoneRaw = peeled.phoneRaw;
        let rest = peeled.rest;
        if (!rest) continue;

        if (/^\d+$/.test(rest)) {
          const value = Number(rest);
          // A bare number that is not a plausible seat count and not long
          // enough to be a phone. Flagged rather than dropped: it is usually a
          // seat count typed wrong, and she would want to fix it.
          if (value >= 1 && value <= MAX_SEATS) allowedCount = value;
          else unreadable = true;
          continue;
        }

        const withSeats = peelSeats(rest);
        if (withSeats.seats !== null) {
          allowedCount = withSeats.seats;
          rest = withSeats.rest;
        }
        // A second word-ish field is usually a family name split off by a
        // comma — joining keeps it with the name rather than losing it.
        if (rest) nameParts.push(rest);
      }

      const nameAr = nameParts.join(" ").trim();
      const phone = phoneRaw ? normalizePhone(phoneRaw, DEFAULT_PHONE_COUNTRY) : null;
      const row: ParsedRow = { line, raw, nameAr, phone, allowedCount, status: "ok" };

      if (!nameAr) row.status = "noName";
      else if (nameAr.length < MIN_NAME_LENGTH) row.status = "nameShort";
      else if (unreadable) row.status = "unreadableField";
      else if (phoneRaw && !phone) row.status = "badPhone";
      else if (phone && existing.phones.has(phone)) row.status = "dupExisting";
      else if (phone && seenPhones.has(phone)) row.status = "dupInList";
      // With no phone the name is all there is to go on. Two «أم فهد» in one
      // list are far more likely to be one person pasted twice than two
      // guests — but it is HER list, so this is a warning she can keep, never
      // a row the import silently drops.
      else if (!phone && existing.names.has(nameAr)) row.status = "dupExisting";
      else if (!phone && seenNames.has(nameAr)) row.status = "dupInList";

      if (nameAr) seenNames.add(nameAr);
      if (phone) seenPhones.add(phone);
      return row;
    });
}

/**
 * Non-empty lines in what she pasted, BEFORE the parser truncates.
 *
 * `parseGuestList` slices to MAX_IMPORT_LINES so the review table stays
 * bounded, which means the caller can never see that it happened — a 900-name
 * paste would import 800 and report success. This is how the cap is actually
 * enforced.
 */
export function countGuestLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

/** Rows that can be written as they stand — a duplicate is a warning, not a refusal. */
export function isCommittable(row: ParsedRow): boolean {
  return row.status !== "noName" && row.status !== "nameShort" && row.status !== "unreadableField";
}
