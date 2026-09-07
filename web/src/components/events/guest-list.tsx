"use client";

import { useMemo, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { GuestRow, type RsvpBadge } from "@/components/events/guest-row";
import { normalizeArabic } from "@/lib/arabic";

/** One guest, in the shape the row needs plus what the filters read. */
export interface GuestListEntry {
  id: string;
  nameAr: string;
  phone: string | null;
  allowedCount: number;
  checkedInCount: number;
  isBlocked: boolean;
  companions: number | null;
  activity: string;
  invitationUrl: string;
  waMessage: string;
  rsvp?: RsvpBadge;
  /** Whether her invitation has actually gone out — the "not sent" filter. */
  sent: boolean;
}

export type GuestFilter = "all" | "accepted" | "declined" | "pending" | "unsent";

/**
 * Which guests survive the box and the chips.
 *
 * Exported and pure so it can be exercised against a real list without a
 * browser: this is the whole behaviour of the screen, and "it looked right
 * when I scrolled" is not a test of it.
 *
 * A name matches through the Arabic fold — a host types "ام فهد" for a guest
 * she saved as "أُمّ فهد". A term of three digits or more is read as a phone
 * and matched on digits alone, so 05…, +966… and ٠٥… are the same number;
 * below three digits it would match half the list and look broken.
 */
/** Digits with the country code and the trunk zero off, so every way of writing one number is the same string. */
function nationalDigits(value: string): string {
  return normalizeArabic(value).replace(/\D/g, "").replace(/^00/, "").replace(/^966/, "").replace(/^0+/, "");
}

export function filterGuests(
  entries: GuestListEntry[],
  query: string,
  filter: GuestFilter,
): GuestListEntry[] {
  const term = query.trim();
  const digits = normalizeArabic(term).replace(/\D/g, "");
  const byPhone = digits.length >= 3;
  const folded = normalizeArabic(term);
  const needle = nationalDigits(term);

  return entries.filter((entry) => {
    if (filter === "accepted" && entry.rsvp !== "accepted") return false;
    if (filter === "declined" && entry.rsvp !== "declined") return false;
    if (filter === "pending" && (entry.rsvp === "accepted" || entry.rsvp === "declined")) return false;
    if (filter === "unsent" && entry.sent) return false;
    if (!term) return true;
    if (byPhone) {
      const stored = entry.phone ?? "";
      // Both sides reduced to the national part first. Stored numbers are
      // E.164 (`+966510000074`), and a host types `0510000074` — a plain
      // substring test finds neither in the other, because one carries the
      // country code and the other the trunk zero.
      return (
        nationalDigits(stored).includes(needle) ||
        stored.replace(/\D/g, "").includes(digits)
      );
    }
    return normalizeArabic(entry.nameAr).includes(folded);
  });
}

/** How many rows to put in the DOM before asking. */
const PAGE = 40;

/**
 * Three hundred names, and a way through them.
 *
 * The list rendered every guest, unfiltered and unsearchable, which is fine at
 * twenty and useless at three hundred: a host looking for one woman scrolled
 * until she found her or gave up. It also put three hundred interactive rows
 * into the page at once on a phone.
 *
 * Filtering happens here rather than through the URL because the question is
 * "where is ريم" and the answer should arrive as she types — a round trip per
 * keystroke would be slower than scrolling. The rows were already client
 * components, so nothing extra is shipped to make this work.
 *
 * Names match through the Arabic fold, the same one the door search uses: a
 * host types "ام فهد" for a guest she saved as "أُمّ فهد" and expects to find
 * her. Numbers match on digits alone, so 05…, +966… and ٠٥… are one thing.
 */
export function GuestList({
  eventId,
  locale,
  dict,
  entries,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  entries: GuestListEntry[];
}) {
  const d = dict.events.detail;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GuestFilter>("all");
  const [limit, setLimit] = useState(PAGE);

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");

  const counts = useMemo(
    () => ({
      all: entries.length,
      accepted: entries.filter((e) => e.rsvp === "accepted").length,
      declined: entries.filter((e) => e.rsvp === "declined").length,
      pending: entries.filter((e) => e.rsvp !== "accepted" && e.rsvp !== "declined").length,
      unsent: entries.filter((e) => !e.sent).length,
    }),
    [entries],
  );

  const matches = useMemo(() => filterGuests(entries, query, filter), [entries, query, filter]);

  const shown = matches.slice(0, limit);
  const CHIPS: { key: GuestFilter; label: string }[] = [
    { key: "all", label: d.guestFilterAll },
    { key: "accepted", label: d.guestFilterAccepted },
    { key: "declined", label: d.guestFilterDeclined },
    { key: "pending", label: d.guestFilterPending },
    { key: "unsent", label: d.guestFilterUnsent },
  ];

  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="sr-only">{d.guestSearchLabel}</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            type="search"
            enterKeyHint="search"
            placeholder={d.guestSearchPlaceholder}
            className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          />
        </label>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {CHIPS.map((chip) => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFilter(chip.key);
                  setLimit(PAGE);
                }}
                className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                  active
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-border bg-bg text-fg-muted hover:text-fg"
                }`}
              >
                {chip.label} {nf.format(counts[chip.key])}
              </button>
            );
          })}
        </div>
      </div>

      {matches.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-fg-muted">{d.guestNoMatch}</p>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1.4fr)_auto_auto_minmax(0,1fr)_auto] gap-4 border-b border-border px-4 py-2.5 text-[11px] font-bold text-fg-muted sm:grid">
            <span>{d.colGuest}</span>
            <span className="text-center">{d.colCompanions}</span>
            <span>{d.colStatus}</span>
            <span>{d.colActivity}</span>
            <span />
          </div>

          {shown.map((entry) => (
            <GuestRow
              key={entry.id}
              eventId={eventId}
              locale={locale}
              dict={dict}
              guest={{
                id: entry.id,
                nameAr: entry.nameAr,
                phone: entry.phone,
                allowedCount: entry.allowedCount,
                checkedInCount: entry.checkedInCount,
                isBlocked: entry.isBlocked,
              }}
              companions={entry.companions}
              activity={entry.activity}
              invitationUrl={entry.invitationUrl}
              waMessage={entry.waMessage}
              rsvp={entry.rsvp}
            />
          ))}

          {matches.length > shown.length && (
            <div className="border-t border-border px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE)}
                className="h-10 rounded-full border border-accent px-5 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-accent-fg"
              >
                {d.guestShowMore.replace("{count}", nf.format(matches.length - shown.length))}
              </button>
              <p className="mt-2 text-xs text-fg-muted">
                {d.guestShowingCount
                  .replace("{shown}", nf.format(shown.length))
                  .replace("{total}", nf.format(matches.length))}
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
