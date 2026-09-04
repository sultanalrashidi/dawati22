"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { createPerInvitationOrderAction } from "@/lib/orders/actions";
import {
  DEFAULT_INVITATIONS,
  INVITATION_PRESETS,
  INVITATION_STEP,
  MAX_INVITATIONS,
  MIN_INVITATIONS,
  clampInvitationCount,
  totalSar,
} from "@/lib/orders/pricing";

export interface TierRate {
  tier: "WITH_QR" | "NO_QR";
  unitPrice: number;
}

/**
 * The last thing before paying: how many people, and whether they scan a code
 * at the door.
 *
 * The same slider and the same `totalSar` as the pricing page, so the number
 * she saw while browsing is the number she is charged. What is different is
 * that it now sits on top of an invitation that already exists — so the button
 * says "activate", not "buy", and paying has something to deliver.
 *
 * Nothing about the price is posted. The server re-reads the rate and
 * recomputes the total; the form carries only which draft, which tier, and how
 * many.
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
  initialTier: "WITH_QR" | "NO_QR";
  initialCount: number;
}) {
  const p = dict.plans;
  const d = dict.draft;
  const [count, setCount] = useState(clampInvitationCount(initialCount || DEFAULT_INVITATIONS));
  const [tier, setTier] = useState<"WITH_QR" | "NO_QR">(initialTier);

  const nf = useMemo(
    () => new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US"),
    [locale],
  );

  const rate = tier === "WITH_QR" ? rates.withQr : rates.noQr;
  const total = Number(totalSar(count, rate.unitPrice));
  const filled = ((count - MIN_INVITATIONS) / (MAX_INVITATIONS - MIN_INVITATIONS)) * 100;
  const fillDirection = locale === "ar" ? "to left" : "to right";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-fg-muted">{p.countLabel}</span>
          <span className="flex items-baseline gap-1.5">
            <b className="text-4xl font-semibold leading-none tabular-nums text-accent">{nf.format(count)}</b>
            <span className="text-sm text-fg-muted">{p.countUnit}</span>
          </span>
        </div>

        <div className="mt-6">
          <input
            type="range"
            min={MIN_INVITATIONS}
            max={MAX_INVITATIONS}
            step={INVITATION_STEP}
            value={count}
            onChange={(e) => setCount(clampInvitationCount(Number(e.target.value)))}
            aria-label={p.countLabel}
            aria-valuetext={`${count} ${p.countUnit}`}
            className="dawati-range"
            style={{
              background: `linear-gradient(${fillDirection}, var(--color-accent) 0% ${filled}%, var(--color-border) ${filled}% 100%)`,
            }}
          />
          <div className="mt-2 flex justify-between text-xs tabular-nums text-fg-muted">
            <span>{nf.format(MIN_INVITATIONS)}</span>
            <span>{nf.format(MAX_INVITATIONS)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {INVITATION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={count === preset}
              onClick={() => setCount(preset)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                count === preset
                  ? "border-accent bg-accent font-medium text-accent-fg"
                  : "border-border bg-surface-2 text-fg-muted hover:border-accent hover:text-fg"
              }`}
            >
              {nf.format(preset)}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-fg-muted">{p.stepNote}</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["WITH_QR", "NO_QR"] as const).map((option) => {
          const optionRate = option === "WITH_QR" ? rates.withQr : rates.noQr;
          const selected = tier === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setTier(option)}
              className={`flex flex-col gap-1 rounded-2xl border p-5 text-start transition-colors ${
                selected ? "border-accent bg-accent-soft/10" : "border-border bg-surface hover:border-accent"
              }`}
            >
              <span className="text-base font-bold text-fg">
                {option === "WITH_QR" ? p.tierQr : p.tierNoQr}
              </span>
              <span className="text-sm tabular-nums text-fg-muted">
                {nf.format(optionRate.unitPrice)} {dict.common.sar} {p.perInvitation}
              </span>
              <span className="mt-1 text-lg font-bold tabular-nums text-accent">
                {nf.format(Number(totalSar(count, optionRate.unitPrice)))} {dict.common.sar}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-surface-2 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-fg-muted">{p.total}</span>
          <b className="text-2xl font-bold tabular-nums text-accent">
            {nf.format(total)} {dict.common.sar}
          </b>
        </div>

        {signedIn ? (
          <form action={createPerInvitationOrderAction.bind(null, locale)} className="mt-4">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="tier" value={tier} />
            <input type="hidden" name="count" value={count} />
            <button
              type="submit"
              className="h-12 w-full rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
            >
              {d.activatePay}
            </button>
          </form>
        ) : (
          // Signed out, the choice rides the login URL — including the draft,
          // so the order that gets raised afterwards knows what it is for.
          <Link
            href={`/${locale}/login?next=order&event=${eventId}&tier=${tier}&count=${count}`}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
          >
            {d.activateSignInAndPay}
          </Link>
        )}
      </div>
    </div>
  );
}
