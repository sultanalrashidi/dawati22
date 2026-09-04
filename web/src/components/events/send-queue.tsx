"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { unmarkGuestSentAction } from "@/lib/guests/actions";

/**
 * Sending the invitations, one guest at a time.
 *
 * There is NO automated outbound messaging in this product and this screen
 * does not add any: every message is the host tapping WhatsApp herself, with
 * her own number, in her own words. What the screen removes is the hunting —
 * two hundred guests in a table, no memory of where she stopped, and a decision
 * to make on every row.
 *
 * The hard part is not the UI, it is recording "sent" across a hand-off to
 * another app. Marking on the tap is what the guest table does, and it is
 * unreliable in exactly the case that matters: iOS suspends the tab the moment
 * WhatsApp takes the foreground, and a request that had not been issued yet
 * never is. So this marks on the RETURN instead — the tap only writes a local
 * note, and coming back is what sends it. A tab that is discarded entirely
 * still has the note, and flushes it the next time she opens the queue.
 */

const pendingKey = (eventId: string) => `dawati.sendQueue.${eventId}`;

function readPending(eventId: string): string[] {
  try {
    const raw = window.localStorage.getItem(pendingKey(eventId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    // Private mode, cleared storage, or a browser refusing site data. The
    // queue still works; it just cannot remember across a discarded tab.
    return [];
  }
}

function writePending(eventId: string, ids: string[]) {
  try {
    window.localStorage.setItem(pendingKey(eventId), JSON.stringify(ids));
  } catch {
    // Same: best-effort. Never let storage failure break the send itself.
  }
}

export interface QueueGuest {
  id: string;
  nameAr: string;
  phone: string | null;
  allowedCount: number;
  waHref: string;
  invitationUrl: string;
}

export function SendQueue({
  eventId,
  locale,
  dict,
  guests,
  total,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  guests: QueueGuest[];
  total: number;
}) {
  const d = dict.events.detail;
  const router = useRouter();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");

  // Tracked by ID, not by index: `router.refresh()` removes the rows just
  // marked, and an index cursor would skip whoever slides into the gap.
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [justSent, setJustSent] = useState<QueueGuest | null>(null);
  const [copied, setCopied] = useState(false);

  const remaining = guests.filter((g) => !doneIds.includes(g.id));
  const current = remaining[0] ?? null;
  const sent = total - remaining.length;

  const flush = useCallback(async () => {
    const ids = readPending(eventId);
    if (ids.length === 0) return;
    try {
      const res = await fetch(`/api/events/${eventId}/sent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestIds: ids }),
      });
      if (!res.ok) return; // Keep them: the next return tries again.
      const body: { ids?: string[] } = await res.json();
      const accepted = new Set(body.ids ?? []);
      writePending(
        eventId,
        readPending(eventId).filter((id) => !accepted.has(id)),
      );
      router.refresh();
    } catch {
      // Offline at the venue. The note survives; the next return flushes it.
    }
  }, [eventId, router]);

  // Anything left over from a previous sitting, or from a tab the phone
  // discarded mid-hand-off.
  useEffect(() => {
    void flush();
  }, [flush]);

  // Coming back from WhatsApp. Three events rather than one: visibilitychange
  // does not fire when the wa.me tab opens without hiding this one (a desktop
  // second window, iPad split view), and the screen must never be stuck.
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible") void flush();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
    };
  }, [flush]);

  function handOff(guest: QueueGuest) {
    writePending(eventId, [...new Set([...readPending(eventId), guest.id])]);
    setDoneIds((ids) => [...ids, guest.id]);
    setJustSent(guest);
  }

  async function undo(guest: QueueGuest) {
    writePending(
      eventId,
      readPending(eventId).filter((id) => id !== guest.id),
    );
    setDoneIds((ids) => ids.filter((id) => id !== guest.id));
    setJustSent(null);
    // The note may already have flushed, so the server is asked too. Safe
    // either way: unmarking an invitation that was never marked matches
    // nothing.
    await unmarkGuestSentAction(guest.id, eventId, locale);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col gap-5 px-4 py-8">
      <div>
        <Link href={`/${locale}/events/${eventId}`} className="text-sm text-fg-muted hover:text-fg">
          {d.editBackToDashboard}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-fg">{d.sendQueueTitle}</h1>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">{d.sendQueueHint}</p>
      </div>

      <div>
        <p className="flex items-baseline justify-between text-xs text-fg-muted">
          <span>{d.sendQueueProgress.replace("{sent}", nf.format(sent)).replace("{total}", nf.format(total))}</span>
          <span className="tabular-nums">{nf.format(remaining.length)}</span>
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${total > 0 ? Math.min(100, (sent / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      {justSent && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-success/10 px-4 py-3">
          <p className="text-sm text-success">
            {d.sendQueueRecorded.replace("{name}", justSent.nameAr)}
          </p>
          <button
            type="button"
            onClick={() => undo(justSent)}
            className="text-xs font-bold text-danger hover:underline"
          >
            {d.sendQueueUndo}
          </button>
        </div>
      )}

      {current ? (
        <section className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-xs text-fg-muted">{d.sendQueueNext}</p>
          <p className="mt-2 text-xl font-bold text-fg">{current.nameAr}</p>
          {current.phone ? (
            <p dir="ltr" className="mt-1 text-sm text-fg-muted">{current.phone}</p>
          ) : (
            <p className="mt-1 text-xs text-warning">{d.sendQueueNoPhone}</p>
          )}
          <p className="mt-1 text-xs text-fg-muted">
            {d.sendQueueSeats.replace("{count}", nf.format(current.allowedCount))}
          </p>

          <a
            href={current.waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handOff(current)}
            className="mt-5 flex h-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
          >
            {d.sendQueueWhatsapp}
          </a>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(current.invitationUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                  handOff(current);
                } catch {
                  // Clipboard refused; nothing was shared, so nothing is marked.
                }
              }}
              className="h-9 rounded-full border border-border px-4 text-xs font-medium text-fg"
            >
              {copied ? d.linkCopied : d.copyLink}
            </button>
            {/* The way forward that does not depend on the browser telling us
                she came back — and the honest way to say "not this one". */}
            <button
              type="button"
              onClick={() => handOff(current)}
              className="h-9 rounded-full border border-border px-4 text-xs font-medium text-fg-muted"
            >
              {d.sendQueueMarkSent}
            </button>
            <button
              type="button"
              onClick={() => setDoneIds((ids) => [...ids, current.id])}
              className="h-9 rounded-full px-4 text-xs font-medium text-fg-muted hover:underline"
            >
              {d.sendQueueSkip}
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-base font-bold text-fg">{d.sendQueueAllDone}</p>
          <p className="mt-2 text-sm text-fg-muted">{d.sendQueueAllDoneHint}</p>
          <Link
            href={`/${locale}/events/${eventId}`}
            className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-fg"
          >
            {d.editBackToDashboard}
          </Link>
        </section>
      )}
    </div>
  );
}
