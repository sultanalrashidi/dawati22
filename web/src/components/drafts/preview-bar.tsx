"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * The owner's toolbar over her own preview: what this is, how to get back to
 * editing, how to show a couple of people, and the way onward to paying.
 *
 * Fixed to the bottom rather than the top, because the invitation's own first
 * screen is the envelope and covering it would hide the thing she came to see.
 */
export function PreviewBar({
  dict,
  eventId,
  activated,
  locked,
}: {
  dict: Dictionary;
  eventId: string;
  activated: boolean;
  /** Her details froze when the first invitation went out — nothing left to edit. */
  locked: boolean;
}) {
  const d = dict.draft;
  // Starts closed: she came here to look at her invitation, not at a toolbar.
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<{ url: string; remaining: number } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function openShare() {
    setSharing(true);
    try {
      const res = await fetch(`/api/drafts/${eventId}/share`, { method: "POST" });
      if (res.ok) setShare(await res.json());
    } finally {
      setSharing(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link is on screen and selectable.
    }
  }

  return (
    <div
      dir="rtl"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-3"
    >
      {/* Collapsed by default, and small.
          The invitation is laid out as full-height scroll-snapped screens, so
          ANY fixed bar sits on top of the bottom of every one of them — which
          on a phone meant covering the RSVP form she was trying to look at.
          The toolbar's job is to be reachable, not to be read: one pill wide
          enough to say what this is and get on with it, and everything else
          one tap away. */}
      {!open ? (
        <div className="pointer-events-auto flex max-w-full items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white/95 px-4 text-xs font-bold text-black shadow-lg backdrop-blur"
          >
            {activated ? d.previewBarActivated : d.watermarkPrimary}
            <span aria-hidden="true" className="text-black/40">⌃</span>
          </button>
          {!activated && (
            <Link
              href={`/ar/draft/${eventId}/activate`}
              className="flex h-10 shrink-0 items-center rounded-full bg-black px-5 text-xs font-bold text-white shadow-lg"
            >
              {d.previewBarActivate}
            </Link>
          )}
        </div>
      ) : (
      <div className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-2xl border border-black/10 bg-white/95 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold text-black">
            {activated ? d.previewBarActivated : d.previewBarTitle}
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={dict.common.close}
            className="-m-1 shrink-0 p-1 text-black/40"
          >
            ✕
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-black/60">
          {activated ? d.previewBarActivatedHint : d.previewBarHint}
        </p>

        {share && (
          <div className="flex flex-col gap-1 rounded-lg bg-black/5 px-3 py-2">
            <p className="text-[11px] text-black/70">
              {d.shareRemaining.replace("{n}", String(share.remaining))}
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate text-[11px] text-black/80" dir="ltr">
                {share.url}
              </code>
              <button
                type="button"
                onClick={() => copy(share.url)}
                className="shrink-0 rounded-full bg-black px-3 py-1 text-[11px] font-bold text-white"
              >
                {copied ? d.copied : d.copyLink}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* Before payment the basics live on the draft screens; after it they
              live on her own event, because resolveDraftAccess filters
              `orderId: null` and the draft route would bounce a paid
              invitation to the design gallery. Once the details are locked
              there is nothing to send her to at all. */}
          {(!activated || !locked) && (
            <Link
              href={activated ? `/ar/events/${eventId}/details` : `/ar/draft/${eventId}/basics`}
              className="inline-flex h-9 items-center rounded-full border border-black/20 px-4 text-xs font-bold text-black"
            >
              {activated ? d.previewBarDetails : d.previewBarEdit}
            </Link>
          )}
          {!activated && (
            <>
              {/* The rest of the invitation — mothers, opening, programme,
                  notes, music — all editable before paying, so the preview she
                  is looking at becomes the finished thing rather than defaults
                  standing in for questions nobody asked her yet. */}
              <Link
                href={`/ar/draft/${eventId}/details`}
                className="inline-flex h-9 items-center rounded-full border border-black/20 px-4 text-xs font-bold text-black"
              >
                {d.previewBarDetails}
              </Link>
              <button
                type="button"
                onClick={openShare}
                disabled={sharing}
                className="inline-flex h-9 items-center rounded-full border border-black/20 px-4 text-xs font-bold text-black disabled:opacity-50"
              >
                {d.previewBarShare}
              </button>
              <Link
                href={`/ar/draft/${eventId}/activate`}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-black px-5 text-xs font-bold text-white"
              >
                {d.previewBarActivate}
              </Link>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
