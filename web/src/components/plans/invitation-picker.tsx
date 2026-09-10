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

export type Tier = "WITH_QR" | "NO_QR";

export interface TierRate {
  tier: Tier;
  /** SAR per invitation, from the PricingRate table. */
  unitPrice: number;
}

/**
 * What the button under the total does. A plain object rather than a render
 * prop: the pages that render this picker are Server Components, and a
 * function cannot cross that boundary — a tagged object can.
 */
export type PickerAction =
  /** The draft's activation step: raise an order for this draft, or sign in first. */
  | { kind: "order"; eventId: string; signedIn: boolean }
  /** The pricing page: there is no draft yet, so carry the choice into the gallery. */
  | { kind: "themes" };

/**
 * The one invitation picker: how many people, and whether they scan a code at
 * the door — with a live total.
 *
 * /plans and /draft/[id]/activate render this SAME component, so the number
 * she saw while browsing is laid out exactly as the number she is charged at
 * activation; only the button under the total differs (see PickerAction). The
 * totals come from the same `totalSar()` the order action charges with — one
 * function, so the card and the invoice cannot disagree.
 *
 * Nothing about the price travels. The order form posts only which draft,
 * which tier and how many; the gallery link carries only tier and count. The
 * server re-reads the rate when the order is finally created, so a tampered
 * client can only ask for a different quantity than it displayed.
 */
export function InvitationPicker({
  locale,
  dict,
  rates,
  initialTier,
  initialCount,
  action,
  compareHref,
}: {
  locale: Locale;
  dict: Dictionary;
  rates: { withQr: TierRate; noQr: TierRate };
  initialTier: Tier;
  /** 0 — or anything off the slider — falls back to the default count. */
  initialCount: number;
  action: PickerAction;
  /** When given, a "what is the difference?" link sits under the tier cards. */
  compareHref?: string;
}) {
  const p = dict.plans;
  const [count, setCount] = useState(clampInvitationCount(initialCount || DEFAULT_INVITATIONS));
  const [tier, setTier] = useState<Tier>(initialTier);

  // Arabic reads its own digits; English must not be forced into them.
  const nf = useMemo(
    () => new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US"),
    [locale],
  );

  const rate = tier === "WITH_QR" ? rates.withQr : rates.noQr;
  const total = Number(totalSar(count, rate.unitPrice));
  const filled = ((count - MIN_INVITATIONS) / (MAX_INVITATIONS - MIN_INVITATIONS)) * 100;
  // The track fills from the side the slider starts on, which flips with the
  // page direction — `to left` in Arabic would drain the bar as you drag right.
  const fillDirection = locale === "ar" ? "to left" : "to right";

  return (
    <div className="flex flex-col gap-6">
      <section aria-label={p.countLabel} className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-fg-muted">{p.countLabel}</span>
          <span className="flex items-baseline gap-1.5">
            <b className="text-4xl font-bold leading-none tabular-nums text-accent">{nf.format(count)}</b>
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

      {/* Side by side even on a 360px phone: the whole point of two cards is
          reading one total against the other without scrolling. */}
      <div className="grid grid-cols-2 gap-3">
        {(["WITH_QR", "NO_QR"] as const).map((option) => {
          const optionRate = option === "WITH_QR" ? rates.withQr : rates.noQr;
          const selected = tier === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setTier(option)}
              className={`relative flex flex-col gap-1 rounded-2xl border p-4 text-start transition-colors sm:p-5 ${
                selected ? "border-accent bg-accent-soft/10" : "border-border bg-surface hover:border-accent"
              }`}
            >
              {/* Absolutely placed so the two cards' names still sit on one line. */}
              {option === "WITH_QR" && (
                <span className="absolute -top-2.5 end-3 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-fg">
                  {p.recommended}
                </span>
              )}
              <span className="text-base font-bold text-fg">
                {option === "WITH_QR" ? p.tierQr : p.tierNoQr}
              </span>
              <span className="text-sm tabular-nums text-fg-muted">
                {nf.format(optionRate.unitPrice)} {dict.common.sar} {p.perInvitation}
              </span>
              <span className="text-xs leading-relaxed text-fg-muted">
                {option === "WITH_QR" ? p.tierQrTagline : p.tierNoQrTagline}
              </span>
              <span className="mt-auto pt-1 text-lg font-bold tabular-nums text-accent">
                {nf.format(Number(totalSar(count, optionRate.unitPrice)))} {dict.common.sar}
              </span>
            </button>
          );
        })}
      </div>

      {compareHref && (
        <a href={compareHref} className="-mt-3 self-center text-sm font-bold text-accent hover:underline">
          {p.compareLink}
        </a>
      )}

      <div className="rounded-2xl border border-border bg-surface-2 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-fg-muted">{p.total}</span>
          <b className="text-2xl font-bold tabular-nums text-accent">
            {nf.format(total)} {dict.common.sar}
          </b>
        </div>
        <p className="mt-1 text-end text-xs tabular-nums text-fg-muted">
          {p.totalFormula
            .replace("{rate}", nf.format(rate.unitPrice))
            .replace("{count}", nf.format(count))}
        </p>
        <PickerCta locale={locale} dict={dict} action={action} tier={tier} count={count} />
      </div>
    </div>
  );
}

const CTA_CLASS =
  "mt-4 flex h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong";

function PickerCta({
  locale,
  dict,
  action,
  tier,
  count,
}: {
  locale: Locale;
  dict: Dictionary;
  action: PickerAction;
  tier: Tier;
  count: number;
}) {
  const p = dict.plans;
  const d = dict.draft;

  if (action.kind === "themes") {
    return (
      <>
        {/* Picking a package does not start a payment. It carries the choice
            into the gallery, where she designs the invitation and sees it for
            real before paying — so every order that ever gets created has a
            finished invitation waiting behind it, by construction. */}
        <Link href={`/${locale}/themes?tier=${tier}&count=${count}`} className={CTA_CLASS}>
          {p.startWithChoice}
        </Link>
        <p className="mt-3 text-center text-xs leading-relaxed text-fg-muted">{p.noPaymentYet}</p>
      </>
    );
  }

  if (!action.signedIn) {
    // Signed out, the choice rides the login URL — including the draft, so
    // the order that gets raised afterwards knows what it is for.
    return (
      <Link
        href={`/${locale}/login?next=order&event=${action.eventId}&tier=${tier}&count=${count}`}
        className={CTA_CLASS}
      >
        {d.activateSignInAndPay}
      </Link>
    );
  }

  return (
    <form action={createPerInvitationOrderAction.bind(null, locale)}>
      <input type="hidden" name="eventId" value={action.eventId} />
      <input type="hidden" name="tier" value={tier} />
      <input type="hidden" name="count" value={count} />
      <button type="submit" className={CTA_CLASS}>
        {d.activatePay}
      </button>
    </form>
  );
}
