"use client";

import { useState } from "react";
import { markInvitationSharedAdminAction } from "@/lib/admin/actions";

/**
 * The per-guest share controls on the admin guests page. Same deal as the
 * customer's own row: WhatsApp or copy, and either one records the invitation
 * as sent — the team sharing on the customer's behalf IS the send. The record
 * is fire-and-forget so it can never get in the way of the share itself.
 */
export function GuestShareCell({
  guestId,
  eventId,
  locale,
  url,
  waHref,
  labels,
}: {
  guestId: string;
  eventId: string;
  locale: string;
  url: string;
  waHref: string;
  labels: { whatsapp: string; copy: string; copied: string };
}) {
  const [copied, setCopied] = useState(false);
  const recordShare = () => {
    void markInvitationSharedAdminAction(guestId, eventId, locale).catch(() => {});
  };

  return (
    <span className="flex items-center gap-3">
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={recordShare}
        className="text-xs font-medium text-accent hover:underline"
      >
        {labels.whatsapp}
      </a>
      <button
        type="button"
        className="text-xs text-accent hover:underline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            recordShare();
          } catch {
            // Clipboard refused — no confirmation, no send recorded.
          }
        }}
      >
        {copied ? labels.copied : labels.copy}
      </button>
    </span>
  );
}
