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
 *
 * Always open, and small. It used to collapse to a pill because any fixed bar
 * sits over the bottom of every scroll-snapped screen — on a phone, over the
 * RSVP form. That is solved on the invitation's side now: the page hands
 * `InvitationView` this bar's height as `bottomInset` and every screen keeps
 * that much clear, so the three things she can do stay one tap away, at equal
 * weight, the whole time.
 */

/** Height the page reserves under the invitation for the full bar (caption + one row of buttons). */
export const PREVIEW_BAR_INSET = "6rem";
/** The same for the caption-only pill a shared viewer gets. */
export const PREVIEW_CAPTION_INSET = "3rem";

// The draft's one edit page. The basics and the details used to be two
// screens; the old /basics route redirects here.
function draftEditHref(eventId: string) {
  return `/ar/draft/${eventId}/details`;
}

// Equal cells in a grid, so the row is three (or two) buttons of one size on a
// 360px phone; `leading-tight` lets a label wrap to two lines inside h-10
// rather than overflow.
const BUTTON =
  "flex h-10 min-w-0 items-center justify-center rounded-full px-2 text-center text-xs font-bold leading-tight";
const PRIMARY = `${BUTTON} bg-black text-white`;
const SECONDARY = `${BUTTON} border border-black/20 bg-white text-black`;

export function PreviewBar({
  dict,
  eventId,
  activated,
  locked,
  controls,
}: {
  dict: Dictionary;
  eventId: string;
  activated: boolean;
  /** Her details froze when the first invitation went out — nothing left to edit. */
  locked: boolean;
  /**
   * False for someone she shared the preview with: they get the caption and
   * the privacy link (this page set cookies on them) and none of her controls.
   */
  controls: boolean;
}) {
  const d = dict.draft;
  const [shareOpen, setShareOpen] = useState(false);
  const [share, setShare] = useState<{ url: string; remaining: number } | null>(null);
  const [shareError, setShareError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function toggleShare() {
    if (shareOpen) {
      setShareOpen(false);
      return;
    }
    setShareOpen(true);
    // Minted once per page: the route is a POST that creates the token.
    if (share) return;
    setSharing(true);
    setShareError(false);
    try {
      const res = await fetch(`/api/drafts/${eventId}/share`, { method: "POST" });
      if (res.ok) setShare(await res.json());
      else setShareError(true);
    } catch {
      setShareError(true);
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

  const caption = !controls
    ? d.watermarkPrimary
    : activated
      ? d.previewBarActivated
      : d.previewBarCaption;

  return (
    <div dir="rtl" className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center p-2">
      <div className="pointer-events-auto flex w-full max-w-2xl flex-col gap-1 rounded-2xl border border-black/10 bg-white/95 p-2 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] backdrop-blur">
        {/* One line: what this is, and the policy behind the cookies this page
            sets on whoever opens it. A shared viewer has never seen the site,
            and this segment has no header or footer to carry that link. */}
        <div className="flex items-center justify-between gap-2 px-1 text-[11px] leading-4">
          <p className="min-w-0 truncate font-bold text-black/70">{caption}</p>
          <Link href="/ar/privacy" className="shrink-0 text-black/50 underline underline-offset-2">
            {d.previewPrivacyLink}
          </Link>
        </div>

        {controls && (
          <div className={`grid gap-2 ${activated ? (locked ? "grid-cols-1" : "grid-cols-2") : "grid-cols-3"}`}>
            {activated ? (
              <>
                <Link href={`/ar/events/${eventId}#add-guests`} className={PRIMARY}>
                  {d.activatedAddGuests}
                </Link>
                {/* After payment the details live on her own event, because
                    resolveDraftAccess filters `orderId: null` and the draft
                    route would bounce a paid invitation to the gallery. Once
                    they are locked there is nothing to send her to at all. */}
                {!locked && (
                  <Link href={`/ar/events/${eventId}/details`} className={SECONDARY}>
                    {d.previewBarEditActivated}
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href={draftEditHref(eventId)} className={SECONDARY}>
                  {d.previewBarEdit}
                </Link>
                <button
                  type="button"
                  onClick={toggleShare}
                  disabled={sharing}
                  aria-expanded={shareOpen}
                  className={`${SECONDARY} disabled:opacity-50`}
                >
                  {d.previewBarShare}
                </button>
                <Link href={`/ar/draft/${eventId}/activate`} className={PRIMARY}>
                  {d.previewBarActivate}
                </Link>
              </>
            )}
          </div>
        )}

        {controls && !activated && shareOpen && (
          <div className="flex flex-col gap-1 rounded-lg bg-black/5 px-3 py-2">
            {shareError ? (
              <p className="text-[11px] text-danger">{d.shareError}</p>
            ) : share ? (
              <>
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
              </>
            ) : (
              <p className="text-[11px] text-black/50">{dict.common.loading}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
