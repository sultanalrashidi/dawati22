"use client";

import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { InvitationPicker, type Tier, type TierRate } from "@/components/plans/invitation-picker";

export type { TierRate };

/**
 * The activation step's picker: the shared InvitationPicker with the button
 * that raises an order (or sends her to sign in first).
 *
 * Kept as its own export so the activate page's import stays stable. The
 * slider, tier cards and total live in InvitationPicker and nowhere else —
 * that is what keeps /plans and this step looking identical.
 */
export function ActivatePicker({
  locale,
  dict,
  eventId,
  rates,
  signedIn,
  initialTier,
  initialCount,
}: {
  locale: Locale;
  dict: Dictionary;
  eventId: string;
  rates: { withQr: TierRate; noQr: TierRate };
  /** A signed-out visitor signs in first; the choice rides the login URL. */
  signedIn: boolean;
  initialTier: Tier;
  initialCount: number;
}) {
  return (
    <InvitationPicker
      locale={locale}
      dict={dict}
      rates={rates}
      initialTier={initialTier}
      initialCount={initialCount}
      action={{ kind: "order", eventId, signedIn }}
    />
  );
}
