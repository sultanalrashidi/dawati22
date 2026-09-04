"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { rotateTestInvitationAction } from "@/lib/preview/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

/**
 * Her step nine: see the finished invitation the way a guest will, and send it
 * to someone whose opinion she wants before three hundred people get it.
 *
 * The link is forwardable on purpose — that is the feature — which is also why
 * "change the link" is here: once something is in a family group it is
 * wherever that group forwards it, and a new token is the only way back.
 */
export function TestInvitationCard({
  eventId,
  locale,
  dict,
  url,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  url: string;
}) {
  const d = dict.events.detail;
  const [copied, setCopied] = useState(false);
  const rotate = rotateTestInvitationAction.bind(null, eventId, locale);
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${d.testInvitationShareText}\n${url}`)}`;

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-base font-bold text-fg">{d.testInvitationTitle}</h2>
      <p className="mt-1 text-sm leading-relaxed text-fg-muted">{d.testInvitationBody}</p>

      <p dir="ltr" className="mt-3 truncate rounded-lg bg-surface-2 px-3 py-2 text-start text-xs text-fg-muted">
        {url}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-xs font-bold text-accent-fg transition-colors hover:bg-accent-strong"
        >
          {d.testInvitationOpen}
        </a>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-full border border-border px-4 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
        >
          {d.testInvitationWhatsapp}
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
        <form action={rotate} className="contents">
          <ConfirmSubmitButton
            confirmMessage={d.testInvitationRotateConfirm}
            className="h-9 rounded-full border border-border px-4 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {d.testInvitationRotate}
          </ConfirmSubmitButton>
        </form>
      </div>
    </section>
  );
}
