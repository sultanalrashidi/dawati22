/**
 * Every date this product prints is a Saudi date.
 *
 * A wedding starts at ten in the evening in Riyadh, and that is the only clock
 * that matters: not the server's (UTC on Vercel) and not the guest's phone's.
 * Left to itself `Intl` formats in whatever zone the code happens to run in, so
 * the same invitation renders one hour on the server and another in the
 * browser — a different weekday, and a different Hijri date, printed on the
 * same card. Hence the rule this module exists to enforce: **never construct
 * `Intl.DateTimeFormat` directly for a date a customer will read** — go through
 * `riyadhDateFormat`, which pins the zone for you.
 *
 * The two conversion helpers are the other half. A `datetime-local` input has
 * no zone at all: it posts a wall-clock reading, and `new Date("…T22:00")`
 * resolves it in the *runtime's* zone. So the host types 10:00 PM Thursday, the
 * server stores 22:00 UTC — 1:00 AM Friday in Riyadh — and then reads it back
 * through the same wrong zone, which is why the form always agreed with itself
 * while the invitation did not.
 */

export const RIYADH_TIME_ZONE = "Asia/Riyadh";

/**
 * `Intl.DateTimeFormat`, pinned to Riyadh. Use this everywhere instead of the
 * constructor; a caller cannot forget the zone because there is nowhere to
 * forget it.
 */
export function riyadhDateFormat(
  locales: string | string[],
  options: Intl.DateTimeFormatOptions = {},
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locales, { ...options, timeZone: RIYADH_TIME_ZONE });
}

const PART_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: RIYADH_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The parts of `instant` as Riyadh reads them. */
function riyadhParts(instant: Date) {
  const parts = PART_FORMATTER.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    // Midnight comes back as either "00" or "24" depending on the ICU build.
    hour: value("hour") % 24,
    minute: value("minute"),
    second: value("second"),
  };
}

/**
 * Riyadh's offset from UTC in minutes, at that instant.
 *
 * Saudi Arabia has kept +03:00 with no daylight saving since 1990, so this is
 * `180` in practice — but it is derived rather than hardcoded so a future rule
 * change lands with the tz database instead of needing this file edited.
 */
function riyadhOffsetMinutes(instant: Date): number {
  const p = riyadhParts(instant);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Truncate to whole seconds: `Date.UTC` carries no milliseconds, and the
  // difference would otherwise pick up the instant's.
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return (asIfUtc - wholeSeconds) / 60_000;
}

/**
 * `YYYY-MM-DDTHH:mm` as Riyadh reads it — the value a `datetime-local` field
 * expects, so the field shows the host the hour she typed and not the hour the
 * server happens to keep.
 */
export function toRiyadhDateTimeLocal(date: Date): string {
  const p = riyadhParts(date);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * The reverse: what a `datetime-local` field posted, read as Riyadh wall-clock
 * time, as the instant it names. Returns null for anything that is not that
 * shape, so a caller validates by checking for null rather than for `NaN`.
 */
export function riyadhDateTimeLocalToDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;

  const asIfUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0));
  if (Number.isNaN(asIfUtc)) return null;
  // Subtract the offset in force at the answer, not at the guess — one
  // correction pass is enough for any real zone, and for Riyadh the first
  // guess is already right.
  const guess = new Date(asIfUtc - riyadhOffsetMinutes(new Date(asIfUtc)) * 60_000);
  const instant = new Date(asIfUtc - riyadhOffsetMinutes(guess) * 60_000);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** Gregorian + Hijri (Umm al-Qura) date strings — no dependency, Intl handles both calendars natively. */
export function formatDualDate(date: Date) {
  const gregorian = riyadhDateFormat("ar-SA-u-ca-gregory-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
  const hijri = riyadhDateFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
  const time = riyadhDateFormat("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" }).format(date);
  return { gregorian, hijri, time };
}
