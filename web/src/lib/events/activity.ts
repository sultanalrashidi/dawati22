/**
 * Clock-relative labels for the host dashboard.
 *
 * The page is a server component rendered per request, so reading the clock is
 * correct there — but it is still an impurity, and React's lint rules
 * (rightly) refuse to see it inside a component body. Naming it here keeps the
 * page a pure function of its props and puts every "how long ago" decision in
 * one place.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Whole days from now until `date` — negative once it has passed. */
export function daysUntil(date: Date, now: number = Date.now()): number {
  return Math.ceil((date.getTime() - now) / DAY);
}

/** Whether `eventDate`'s own start time has arrived — day-granular `daysUntil` says "today" for hours before it actually starts. */
export function eventHasStarted(eventDate: Date, now: number = Date.now()): boolean {
  return now >= eventDate.getTime();
}

/**
 * "2 minutes ago" / "yesterday", in the viewer's language. Returns null for a
 * missing date so the caller can say what "never happened" means in context.
 */
export function relativeTime(
  date: Date | null | undefined,
  locale: string,
  now: number = Date.now(),
): string | null {
  if (!date) return null;
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  const diff = date.getTime() - now;

  if (Math.abs(diff) < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (Math.abs(diff) < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  return rtf.format(Math.round(diff / DAY), "day");
}

/**
 * How long after its start time the attendance report keeps refreshing itself.
 * A wedding is one evening; an event from last spring is history, and history
 * does not need polling.
 */
export const ATTENDANCE_LIVE_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * The report's live state, resolved in one call: whether the night is
 * happening now, and the instant the page was rendered.
 *
 * `Date.now()` lives here as a default argument rather than in the page, for
 * the same reason `daysUntil` does — calling it during render is impure, and
 * the React compiler is right to refuse it.
 */
export function attendanceSnapshot(
  eventDate: Date,
  now: number = Date.now(),
): { live: boolean; at: Date } {
  const since = now - eventDate.getTime();
  return { live: since >= 0 && since < ATTENDANCE_LIVE_WINDOW_MS, at: new Date(now) };
}
