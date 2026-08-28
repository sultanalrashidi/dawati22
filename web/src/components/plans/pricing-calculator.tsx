"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { createPerInvitationOrderAction } from "@/lib/orders/actions";
import { supportWhatsAppUrl } from "@/lib/support";
import {
  DEFAULT_INVITATIONS,
  INVITATION_PRESETS,
  INVITATION_STEP,
  MAX_INVITATIONS,
  MIN_INVITATIONS,
  clampInvitationCount,
  totalSar,
} from "@/lib/orders/pricing";

/**
 * The pricing calculator: one slider, two tiers, a live total.
 *
 * The rates arrive as props from the server and the totals are computed with
 * the same `totalSar()` the order action charges with — the number on the card
 * and the number on the invoice come out of one function on purpose.
 *
 * Each tier is its own <form> posting `count` + `tier`. Nothing about the price
 * is posted: the server re-reads the rate and recomputes the total, so the only
 * thing a tampered client can do is order a different quantity than it displayed.
 */

export interface TierOffer {
  tier: "WITH_QR" | "NO_QR";
  /** SAR per invitation, from the PricingRate table. */
  unitPrice: number;
}

export function PricingCalculator({
  locale,
  dict,
  withQr,
  noQr,
  canOrder,
}: {
  locale: Locale;
  dict: Dictionary;
  withQr: TierOffer;
  noQr: TierOffer;
  /** A logged-in customer can buy; anyone else is sent to sign in first. */
  canOrder: boolean;
}) {
  const [count, setCount] = useState(DEFAULT_INVITATIONS);
  const p = dict.plans;

  // Arabic reads its own digits; English must not be forced into them.
  const nf = useMemo(
    () => new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US"),
    [locale],
  );

  const filled = ((count - MIN_INVITATIONS) / (MAX_INVITATIONS - MIN_INVITATIONS)) * 100;
  // The track fills from the side the slider starts on, which flips with the
  // page direction — `to left` in Arabic would drain the bar as you drag right.
  const fillDirection = locale === "ar" ? "to left" : "to right";

  return (
    <>
      <section
        aria-label={p.countLabel}
        className="mt-12 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-fg-muted">{p.countLabel}</span>
          <span className="flex items-baseline gap-1.5">
            <b className="text-4xl font-semibold leading-none text-accent tabular-nums">
              {nf.format(count)}
            </b>
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
            onChange={(event) => setCount(clampInvitationCount(Number(event.target.value)))}
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

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <TierCard
          offer={withQr}
          featured
          name={p.tierQr}
          chooseLabel={p.chooseQr}
          intro={p.qrIncludes}
          features={p.featuresQr}
          {...{ locale, dict, count, nf, canOrder }}
        />
        <TierCard
          offer={noQr}
          name={p.tierNoQr}
          chooseLabel={p.chooseNoQr}
          features={p.featuresNoQr}
          footnote={p.noQrDoorNote}
          {...{ locale, dict, count, nf, canOrder }}
        />
      </div>

      <p className="mt-10 text-center text-sm text-fg-muted">
        {p.moreThanMaxLead}{" "}
        <a
          href={supportWhatsAppUrl(p.moreThanMaxMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent hover:text-accent-strong"
        >
          {p.contactWhatsapp}
        </a>
      </p>
    </>
  );
}

function TierCard({
  locale,
  dict,
  offer,
  count,
  nf,
  canOrder,
  featured,
  name,
  chooseLabel,
  intro,
  features,
  footnote,
}: {
  locale: Locale;
  dict: Dictionary;
  offer: TierOffer;
  count: number;
  nf: Intl.NumberFormat;
  canOrder: boolean;
  featured?: boolean;
  name: string;
  chooseLabel: string;
  /** The "everything in the cheaper tier, plus:" line, when there is one. */
  intro?: string;
  features: readonly string[];
  footnote?: string;
}) {
  const p = dict.plans;
  const total = Number(totalSar(count, offer.unitPrice));
  const boundOrder = createPerInvitationOrderAction.bind(null, locale);

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border bg-surface p-6 ${
        featured ? "border-accent shadow-sm" : "border-border"
      }`}
    >
      {featured ? (
        <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-fg">
          {p.mostPopular}
        </span>
      ) : (
        // Holds the badge's height so both headings sit on the same line.
        <span aria-hidden="true" className="h-[26px]" />
      )}

      <h2 className="text-xl font-semibold text-fg">{name}</h2>

      <div className="flex items-baseline gap-1.5">
        <b className="text-3xl font-semibold leading-none tabular-nums text-fg">
          {nf.format(offer.unitPrice)} {dict.common.sar}
        </b>
        <span className="text-sm text-fg-muted">{p.perInvitation}</span>
      </div>

      <div className="rounded-xl bg-surface-2 px-4 py-3">
        <div className="text-xs text-fg-muted">{p.total}</div>
        <div className="mt-0.5 text-2xl font-semibold tabular-nums text-accent">
          {nf.format(total)} {dict.common.sar}
        </div>
        <div className="mt-0.5 text-xs tabular-nums text-fg-muted">
          {p.totalFormula
            .replace("{rate}", nf.format(offer.unitPrice))
            .replace("{count}", nf.format(count))}
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-sm text-fg">
        {intro && (
          <li className="flex items-start gap-2">
            <Tick />
            <span className="text-fg-muted">{intro}</span>
          </li>
        )}
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Tick />
            {feature}
          </li>
        ))}
      </ul>

      {footnote && <p className="text-xs leading-relaxed text-fg-muted">{footnote}</p>}

      {canOrder ? (
        <form action={boundOrder} className="mt-auto">
          {/* The whole order: what tier, how many. Never a price. */}
          <input type="hidden" name="tier" value={offer.tier} />
          <input type="hidden" name="count" value={count} />
          <button
            type="submit"
            className={`flex h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-colors ${
              featured
                ? "bg-accent text-accent-fg hover:bg-accent-strong"
                : "border border-accent text-accent hover:bg-accent hover:text-accent-fg"
            }`}
          >
            {chooseLabel}
          </button>
        </form>
      ) : (
        <Link
          href={`/${locale}/login`}
          className={`mt-auto flex h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-colors ${
            featured
              ? "bg-accent text-accent-fg hover:bg-accent-strong"
              : "border border-accent text-accent hover:bg-accent hover:text-accent-fg"
          }`}
        >
          {chooseLabel}
        </Link>
      )}
    </div>
  );
}

function Tick() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-success"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}
