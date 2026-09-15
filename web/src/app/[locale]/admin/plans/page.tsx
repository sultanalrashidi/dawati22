import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listPlans } from "@/lib/admin/service";
import { listPricingRates } from "@/lib/orders/service";
import { InvitationTier } from "@/generated/prisma/enums";
import { PricingRateForm } from "@/components/admin/pricing-rates-form";
import { PriceOfferForm } from "@/components/admin/price-offer-form";
import { getPriceOffer } from "@/lib/settings/service";
import { offerPhase } from "@/lib/orders/offer";
import { riyadhDateFormat, toRiyadhDateTimeLocal } from "@/lib/dates";

export default async function AdminPricingPage({ params }: PageProps<"/[locale]/admin/plans">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const [rates, legacyPlans, offer] = await Promise.all([
    listPricingRates(),
    listPlans(),
    getPriceOffer(),
  ]);
  const a = dict.admin;
  const p = dict.plans;

  const now = new Date();
  const phase = offerPhase(offer, now);
  const when = riyadhDateFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
  const statusLine = {
    none: a.offerStatusNone,
    stopped: a.offerStatusStopped,
    scheduled: a.offerStatusScheduled.replace("{date}", offer ? when.format(new Date(offer.startsAt)) : ""),
    live: a.offerStatusLive.replace("{date}", offer ? when.format(new Date(offer.endsAt)) : ""),
    ended: a.offerStatusEnded.replace("{date}", offer ? when.format(new Date(offer.endsAt)) : ""),
  }[phase];

  const labelFor = (tier: InvitationTier) => (tier === InvitationTier.WITH_QR ? p.tierQr : p.tierNoQr);

  // Driven by the tier list, not by the rows that happen to exist: a missing
  // row takes the public pricing page offline, and rendering only what is in
  // the table would leave no way to put it back. Blank means "not set yet".
  const TIERS = [InvitationTier.WITH_QR, InvitationTier.NO_QR] as const;
  const priceFor = (tier: InvitationTier) => {
    const rate = rates.find((r) => r.tier === tier);
    return rate ? Number(rate.unitPrice) : null;
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{a.pricing}</h1>
      <p className="mt-2 max-w-prose text-sm text-fg-muted">{a.pricingIntro}</p>

      <div className="mt-6 flex flex-col gap-3">
        {TIERS.map((tier) => (
          <PricingRateForm
            key={tier}
            locale={locale}
            dict={dict}
            tier={tier}
            label={labelFor(tier)}
            unitPrice={priceFor(tier)}
          />
        ))}
      </div>

      <PriceOfferForm
        locale={locale}
        dict={dict}
        phase={phase}
        statusLine={statusLine}
        defaults={{
          nameAr: offer?.nameAr ?? "",
          nameEn: offer?.nameEn ?? "",
          withQr: offer?.withQr ?? null,
          noQr: offer?.noQr ?? null,
          // A fresh offer starts now unless told otherwise; an old one shows
          // its own dates, ready to be moved to the next occasion.
          startsAt: toRiyadhDateTimeLocal(offer ? new Date(offer.startsAt) : now),
          endsAt: offer ? toRiyadhDateTimeLocal(new Date(offer.endsAt)) : "",
        }}
      />

      {/* Read-only on purpose: these rows are what an old order points at, and
          the count a customer paid for now lives on the order itself. Editing
          one here would rewrite history without changing anything live. */}
      {legacyPlans.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-fg">{a.legacyPlans}</h2>
          <p className="mt-1 text-sm text-fg-muted">{a.legacyPlansNote}</p>
          <div className="mt-4 flex flex-col gap-2">
            {legacyPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-2/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-fg">
                    {locale === "ar" ? plan.nameAr : plan.name}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {p.invitations.replace("{count}", String(plan.invitationCount))} ·{" "}
                    {Number(plan.price)} {dict.common.sar}
                  </p>
                </div>
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
                  {plan.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
