/**
 * Clock-relative labels for the host dashboard.
 *
 * The page is a server component rendered per request, so reading the clock is
 * correct there — but it is still an impurity, and React's lint rules
 * (rightly) refuse to see it inside a component body. Naming it here keeps the
 * page a pure function of its props and puts every "how long ago" decision in
 * one place.
 */

import { toRiyadhDateTimeLocal } from "@/lib/dates";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Calendar days between today and the wedding, counted in Riyadh.
 *
 * It used to be `Math.ceil` of a millisecond difference, which is not the
 * question anyone is asking. On the morning of her own wedding the dashboard
 * read «باقي يوم واحد», and kept saying it four hours before the ceremony —
 * because 08:00 to 22:00 rounds up to one whole day. «اليوم» only appeared
 * once the party had already started, which is the one moment nobody is
 * looking. It also read three days on the Wednesday before a Friday, when
 * anyone counting sleeps says two.
 *
 * So it compares DATES, in the only clock that matters here. Zero means today
 * whatever the hour; `eventHasStarted` is the separate question of whether the
 * moment itself has passed.
 */
export function daysUntil(date: Date, now: number = Date.now()): number {
  return riyadhDayNumber(date) - riyadhDayNumber(new Date(now));
}

/** Which Riyadh calendar day an instant falls on, as a comparable integer. */
function riyadhDayNumber(instant: Date): number {
  const [year, month, day] = toRiyadhDateTimeLocal(instant).slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY);
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
