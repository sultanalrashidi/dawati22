"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  disableGateLinkAction,
  enableGateLinkAction,
  rotateGateLinkAction,
} from "@/lib/gatepin/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

/**
 * The door team's link: she sends it on WhatsApp, they tap it, the scanner
 * opens — no reference code, no PIN to type at the door.
 *
 * "Change" and "stop" both close every door already opened, which is the
 * whole answer to "I sent it to the wrong group".
 */
export function GateLinkCard({
  eventId,
  locale,
  dict,
  url,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  /** Null while the link is switched off. */
  url: string | null;
}) {
  const d = dict.events.detail;
  const [copied, setCopied] = useState(false);

  if (!url) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-bold text-fg">{d.gateLinkTitle}</p>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">{d.gateLinkBody}</p>
        <form action={enableGateLinkAction.bind(null, eventId, locale)} className="mt-3">
          <button
            type="submit"
            className="h-10 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-strong"
          >
            {d.gateLinkEnable}
          </button>
        </form>
      </div>
    );
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${d.gateLinkShareText}\n${url}`)}`;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-bold text-fg">{d.gateLinkTitle}</p>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">{d.gateLinkActiveBody}</p>

      <p dir="ltr" className="mt-3 truncate rounded-lg bg-surface-2 px-3 py-2 text-start text-xs text-fg-muted">
        {url}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-xs font-bold text-accent-fg transition-colors hover:bg-accent-strong"
        >
          {d.gateLinkWhatsapp}
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard can be refused; the link is on screen and selectable.
            }
          }}
          className="h-9 rounded-full border border-border px-4 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
        >
          {copied ? d.testInvitationCopied : d.testInvitationCopy}
        </button>
        <form action={rotateGateLinkAction.bind(null, eventId, locale)} className="contents">
          <ConfirmSubmitButton
            confirmMessage={d.gateLinkRotateConfirm}
            className="h-9 rounded-full border border-border px-4 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {d.gateLinkRotate}
          </ConfirmSubmitButton>
        </form>
        <form action={disableGateLinkAction.bind(null, eventId, locale)} className="contents">
          <ConfirmSubmitButton
            confirmMessage={d.gateLinkDisableConfirm}
            className="h-9 rounded-full border border-border px-4 text-xs text-danger transition-colors hover:bg-danger/10"
          >
            {d.gateLinkDisable}
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
