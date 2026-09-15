/** The running offer, as the visitor reads it. Built on the server by `offerNotice`. */
export interface OfferNotice {
  /** The owner's name for it, e.g. «عرض اليوم الوطني». */
  name: string;
  /** «ينتهي العرض …», already formatted in Riyadh time. */
  endsLabel: string;
}

/**
 * The price offer, announced where prices are read — above the landing page's
 * price cards and at the top of the invitation picker.
 *
 * Hook-free so a Server Component (the landing page) and a Client one (the
 * picker) can both render it. The end date arrives already formatted from the
 * server: formatting it in the browser would print the visitor's own clock and
 * make the page disagree with itself on hydration.
 */
export function OfferBanner({ offer, className = "" }: { offer: OfferNotice; className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-center ${className}`}
    >
      <b className="text-base font-bold text-success">{offer.name}</b>
      <span className="text-xs text-fg-muted">{offer.endsLabel}</span>
    </div>
  );
}
