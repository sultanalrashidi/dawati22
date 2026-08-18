"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { toggleGuestBlockedAction, deleteGuestAction } from "@/lib/guests/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type RsvpBadge = "accepted" | "declined" | "pending";

const RSVP_BADGE_STYLE: Record<RsvpBadge, string> = {
  accepted: "bg-success/10 text-success",
  declined: "bg-danger/10 text-danger",
  pending: "bg-surface-2 text-fg-muted",
};

export function GuestRow({
  eventId,
  locale,
  dict,
  guest,
  invitationUrl,
  waMessage,
  rsvp,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  guest: { id: string; nameAr: string; allowedCount: number; checkedInCount: number; isBlocked: boolean };
  invitationUrl: string;
  waMessage: string;
  rsvp?: RsvpBadge;
}) {
  const [copied, setCopied] = useState(false);
  const boundToggleBlock = toggleGuestBlockedAction.bind(null, guest.id, eventId, locale, !guest.isBlocked);
  const boundDelete = deleteGuestAction.bind(null, guest.id, eventId, locale);
  const waHref = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;
  const rsvpLabel =
    rsvp === "accepted"
      ? dict.events.detail.rsvpAccepted
      : rsvp === "declined"
        ? dict.events.detail.rsvpDeclined
        : dict.events.detail.rsvpPending;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-fg">
          {guest.nameAr}
          {guest.isBlocked && (
            <span className="ms-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
              {dict.events.detail.blocked}
            </span>
          )}
          {rsvp && (
            <span className={`ms-2 rounded-full px-2 py-0.5 text-xs ${RSVP_BADGE_STYLE[rsvp]}`}>
              {rsvpLabel}
            </span>
          )}
        </p>
        <p className="text-sm text-fg-muted">
          {dict.events.detail.checkedIn
            .replace("{in}", String(guest.checkedInCount))
            .replace("{allowed}", String(guest.allowedCount))}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(invitationUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="h-9 rounded-full border border-border px-3 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
        >
          {copied ? dict.events.detail.linkCopied : dict.events.detail.copyLink}
        </button>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 items-center rounded-full bg-accent px-3 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-strong inline-flex"
        >
          {dict.events.detail.sendWhatsapp}
        </a>
        <form action={boundToggleBlock}>
          <button
            type="submit"
            className="h-9 rounded-full border border-border px-3 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
          >
            {guest.isBlocked ? dict.events.detail.unblock : dict.events.detail.block}
          </button>
        </form>
        <form action={boundDelete}>
          <ConfirmSubmitButton
            confirmMessage={dict.events.detail.confirmRemove}
            className="h-9 rounded-full border border-danger/30 px-3 text-xs font-medium text-danger transition-colors hover:bg-danger/10"
          >
            {dict.events.detail.remove}
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
