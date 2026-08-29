/**
 * What a custom design costs.
 *
 * A constant rather than a settings row on purpose: unlike the invitation
 * rates, this is one number for one service, and every request SNAPSHOTS it
 * (`CustomDesignRequest.priceSar`) the moment it is made — so changing it here
 * prices new requests only and never re-prices one already in flight. Free of
 * `server-only` and of Prisma so the customer-facing copy and the order that
 * charges can read the same value.
 */
export const CUSTOM_DESIGN_PRICE_SAR = 150;

/** How many rounds of changes the fee covers. Shown to the customer up front. */
export const CUSTOM_DESIGN_REVISIONS_INCLUDED = 2;
