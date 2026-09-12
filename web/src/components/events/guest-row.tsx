"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  toggleGuestBlockedAction,
  deleteGuestAction,
  markInvitationSharedAction,
} from "@/lib/guests/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { normalizePhone, DEFAULT_PHONE_COUNTRY } from "@/lib/security/phone";

export type RsvpBadge = "accepted" | "declined" | "pending";

const RSVP_BADGE_STYLE: Record<RsvpBadge, string> = {
  accepted: "bg-success/10 text-success",
  declined: "bg-danger/10 text-danger",
  pending: "bg-surface-2 text-fg-muted",
};

/**
 * One guest in the replies table.
 *
 * The actions are the ones the product actually has: copy the guest's private
 * link, or hand it to WhatsApp. There is no automated outbound channel — the
 * host presses send themselves, every time — so nothing here claims otherwise.
 */
export function GuestRow({
  eventId,
  locale,
  dict,
  guest,
  invitationUrl,
  waMessage,
  rsvp,
  companions,
  activity,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  guest: { id: string; nameAr: string; phone?: string | null; allowedCount: number; checkedInCount: number; isBlocked: boolean };
  invitationUrl: string;
  waMessage: string;
  rsvp?: RsvpBadge;
  /** Seats the guest said they are bringing; null when they have not replied. */
  companions: number | null;
  /** Already-formatted "opened, no reply · yesterday" line. */
  activity: string;
}) {
  const [copied, setCopied] = useState(false);
  const boundToggleBlock = toggleGuestBlockedAction.bind(null, guest.id, eventId, locale, !guest.isBlocked);
  const boundDelete = deleteGuestAction.bind(null, guest.id, eventId, locale);
  // Records "this invitation was actually sent" the moment the host shares —
  // fire-and-forget so a hiccup here can never get in the way of the share
  // itself, which has already happened.
  const recordShare = () => {
    void markInvitationSharedAction(guest.id, eventId, locale).catch(() => {});
  };
  // Straight into her chat when the number reads as one — the same rule as the
  // send page and the team's page. Without a number (or with one that does
  // not read), WhatsApp's own contact picker, rather than a guessed recipient.
  const to = guest.phone ? normalizePhone(guest.phone, DEFAULT_PHONE_COUNTRY) : null;
  const waHref = `https://wa.me/${to ? to.slice(1) : ""}?text=${encodeURIComponent(waMessage)}`;
  const d = dict.events.detail;
  const rsvpLabel = rsvp === "accepted" ? d.rsvpAccepted : rsvp === "declined" ? d.rsvpDeclined : d.rsvpPending;

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1.4fr)_auto_auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="flex items-start justify-between gap-3 sm:block sm:min-w-0">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
            <span className="truncate">{guest.nameAr}</span>
            {guest.isBlocked && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">{d.blocked}</span>
            )}
          </p>
          {guest.phone && (
            <p dir="ltr" className="mt-0.5 text-start text-xs text-fg-muted">
              {guest.phone}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs sm:hidden ${RSVP_BADGE_STYLE[rsvp ?? "pending"]}`}
        >
          {rsvpLabel}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-fg-muted sm:hidden">
        <span>
          {d.colCompanions}: <span className="tabular-nums">{companions === null ? "—" : companions}</span>
        </span>
        <span className="truncate">{activity}</span>
      </div>

      <p className="hidden text-sm tabular-nums text-fg-muted sm:block sm:text-center">
        {companions === null ? "—" : companions}
      </p>

      <p className="hidden sm:block">
        <span className={`rounded-full px-2.5 py-1 text-xs ${RSVP_BADGE_STYLE[rsvp ?? "pending"]}`}>
          {rsvpLabel}
        </span>
      </p>

      <p className="hidden truncate text-xs text-fg-muted sm:block">{activity}</p>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(invitationUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            recordShare();
          }}
          className="h-8 rounded-full border border-border px-3 text-center text-xs font-medium text-fg transition-colors hover:bg-surface-2"
        >
          {copied ? d.linkCopied : d.copyLink}
        </button>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={recordShare}
          className="inline-flex h-8 items-center justify-center rounded-full bg-accent px-3 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-strong"
        >
          {d.sendWhatsapp}
        </a>
        <form action={boundToggleBlock} className="contents">
          <button
            type="submit"
            className="h-8 rounded-full border border-border px-3 text-center text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {guest.isBlocked ? d.unblock : d.block}
          </button>
        </form>
        <form action={boundDelete} className="contents">
          <ConfirmSubmitButton
            confirmMessage={d.confirmRemove}
            className="h-8 rounded-full border border-danger/30 px-3 text-center text-xs font-medium text-danger transition-colors hover:bg-danger/10"
          >
            {d.remove}
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
