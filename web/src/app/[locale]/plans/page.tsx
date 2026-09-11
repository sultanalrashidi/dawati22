import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listPricingRates } from "@/lib/orders/service";
import { InvitationTier } from "@/generated/prisma/enums";
import { supportWhatsAppUrl } from "@/lib/support";
import { walletPassesConfigured } from "@/lib/wallet/availability";
import { InvitationPicker } from "@/components/plans/invitation-picker";
import { TierComparison } from "@/components/plans/tier-comparison";
import { QueryNotice } from "@/components/query-notice";

// A file on the CDN, rebuilt in the background at most every five minutes and
// at once whenever a rate changes (updatePricingRateAction). Nothing here may
// read the request — the query is applied in the browser instead.
export const revalidate = 300;

/**
 * The pricing page: the activation picker, shown before there is anything to
 * activate. Same slider, same tier cards, same total, so what she sees here is
 * exactly what she meets again at the last step; the only difference is that
 * the button carries her choice into the gallery instead of raising an order.
 * Under it, the comparison a first-time customer needs to choose a tier.
 */
export default async function PlansPage({ params }: PageProps<"/[locale]/plans">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const p = dict.plans;

  // Both rates live in the PricingRate table, seeded by the
  // per_invitation_pricing migration. If one is missing the page says so
  // rather than rendering a card with no price in it.
  const rates = await listPricingRates();
  const rateOf = (tier: InvitationTier): number | null => {
    const rate = rates.find((r) => r.tier === tier);
    return rate ? Number(rate.unitPrice) : null;
  };
  const withQr = rateOf(InvitationTier.WITH_QR);
  const noQr = rateOf(InvitationTier.NO_QR);

  // The wallet line is the one feature the environment decides — the same
  // server-only check the landing page's wallet card asks. Only the boolean
  // travels, so the page never advertises a pass no wallet here can issue.
  const walletAvailable = walletPassesConfigured();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">{p.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{p.subtitle}</p>
        <p className="mt-1 text-xs text-fg-muted">{p.hint}</p>
      </div>

      <QueryNotice
        param="error"
        fallback={dict.common.error}
        className="rounded-xl bg-danger/10 px-4 py-3 text-center text-sm text-danger"
      />

      {withQr !== null && noQr !== null ? (
        <>
          <InvitationPicker
            locale={locale}
            dict={dict}
            rates={{
              withQr: { tier: "WITH_QR", unitPrice: withQr },
              noQr: { tier: "NO_QR", unitPrice: noQr },
            }}
            // Coming back from the gallery (or opening a shared link) keeps
            // the choice — applied in the browser, see `choiceFromUrl`.
            initialTier="WITH_QR"
            initialCount={0}
            choiceFromUrl
            action={{ kind: "themes" }}
            compareHref="#compare"
          />
          <TierComparison dict={dict} walletAvailable={walletAvailable} />
        </>
      ) : (
        <p className="text-center text-fg-muted">{dict.common.empty}</p>
      )}

      <p className="text-center text-sm text-fg-muted">
        {p.moreThanMaxLead}{" "}
        <a
          href={supportWhatsAppUrl(p.moreThanMaxMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-accent hover:text-accent-strong"
        >
          {p.contactWhatsapp}
        </a>
      </p>
    </div>
  );
}
