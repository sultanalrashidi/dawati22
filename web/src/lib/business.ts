/**
 * Who the store legally is.
 *
 * The store's public reference is the شهادة توثيق التجارة الإلكترونية the Saudi
 * Business Center granted it: the footer badge, the contact page and the terms
 * all cite that certificate and read its number from here, so they can never
 * disagree with each other. Contact channels live in `support.ts`; this file
 * is identity only.
 *
 * The certificate was issued against the store's وثيقة عمل حر (FL-288355247).
 * That licence is deliberately NOT printed anywhere on the site any more: the
 * public register already shows which licence the certificate is linked to,
 * and the certificate is the thing a customer can check for herself.
 */
export const BUSINESS = {
  /**
   * The e-commerce authentication the Saudi Business Center granted on
   * 2026-09-08 to «متجر دعوتي / Dawati Store».
   *
   * The certificate PDF carries no seal, no QR and no permanent link, so the
   * honest way to show it is the number plus the public register: a visitor
   * types the number into `inquiryUrl` — no login — and sees the store name,
   * the linked licence and the status. Do NOT reproduce the Saudi Business
   * Center or Ministry of Commerce emblems on this site to stand in for it.
   *
   * The per-store page on that register (/certificate-details/…) is not
   * linkable: its path carries a lookup token that expires. Link the search.
   *
   * `expires` is the certificate's own expiry, and the badge stops rendering
   * by itself once that date passes — an authentication claim must never
   * outlive the authentication. Renew from business.sa and bump the date.
   */
  authentication: {
    number: "0000324743",
    expires: new Date("2027-08-25T23:59:59+03:00"),
    inquiryUrl: "https://eauthenticate.saudibusiness.gov.sa/inquiry",
  },
} as const;

/** Whether the e-commerce authentication is still in force today. */
export function isAuthenticationValid(now: Date = new Date()): boolean {
  return now <= BUSINESS.authentication.expires;
}
