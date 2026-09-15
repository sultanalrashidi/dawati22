import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import type { LivePricing } from "@/lib/orders/service";
import type { OfferNotice } from "@/components/plans/offer-banner";
import { riyadhDateFormat } from "@/lib/dates";

/**
 * The running offer in the visitor's language, with its end in Riyadh time —
 * or null when no offer is lowering a price right now.
 */
export function offerNotice(
  offer: LivePricing["offer"],
  locale: Locale,
  dict: Dictionary,
): OfferNotice | null {
  if (!offer) return null;
  const name = locale === "ar" ? offer.nameAr : offer.nameEn || dict.plans.offerFallbackName;
  const ends = riyadhDateFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(offer.endsAt);
  return { name, endsLabel: dict.plans.offerEnds.replace("{date}", ends) };
}
