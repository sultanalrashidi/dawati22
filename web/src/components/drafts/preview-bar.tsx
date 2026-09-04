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
}: {
  dict: Dictionary;
  eventId: string;
  activated: boolean;
}) {
  const d = dict.draft;
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
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-black/10 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        <p className="text-xs font-bold text-black">
          {activated ? d.previewBarActivated : d.previewBarTitle}
        </p>
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
          <Link
            href={`/ar/draft/${eventId}/basics`}
            className="inline-flex h-9 items-center rounded-full border border-black/20 px-4 text-xs font-bold text-black"
          >
            {d.previewBarEdit}
          </Link>
          {!activated && (
            <>
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
    </div>
  );
}
