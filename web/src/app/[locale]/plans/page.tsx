import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { listPricingRates } from "@/lib/orders/service";
import { InvitationTier } from "@/generated/prisma/enums";
import { PricingCalculator, type TierOffer } from "@/components/plans/pricing-calculator";

export default async function PlansPage({ params, searchParams }: PageProps<"/[locale]/plans">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);

  const [rates, user] = await Promise.all([listPricingRates(), getSessionUser()]);
  const canOrder = user?.role === "CUSTOMER";

  const offerFor = (tier: InvitationTier): TierOffer | null => {
    const rate = rates.find((r) => r.tier === tier);
    return rate ? { tier, unitPrice: Number(rate.unitPrice) } : null;
  };
  const withQr = offerFor(InvitationTier.WITH_QR);
  const noQr = offerFor(InvitationTier.NO_QR);

  const p = dict.plans;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-fg">{p.title}</h1>
        <p className="mt-2 text-fg-muted">{p.subtitle}</p>
        <p className="mt-1 text-sm text-fg-muted">{p.hint}</p>
      </div>

      {search?.error && (
        <p className="mt-6 rounded-xl bg-danger/10 px-4 py-3 text-center text-sm text-danger">
          {dict.common.error}
        </p>
      )}

      {/* Both rates live in the PricingRate table, seeded by the
          per_invitation_pricing migration. If one is missing the page says so
          rather than rendering a card with no price in it. */}
      {withQr && noQr ? (
        <PricingCalculator
          locale={locale}
          dict={dict}
          withQr={withQr}
          noQr={noQr}
          canOrder={canOrder}
        />
      ) : (
        <p className="mt-12 text-center text-fg-muted">{dict.common.empty}</p>
      )}
    </div>
  );
}
