/**
 * Who the store legally is.
 *
 * Saudi e-commerce rules require an online store to show its registration or
 * licence number where a visitor can find it, and the Saudi Business Center
 * checks for exactly that before issuing the شهادة توثيق التجارة الإلكترونية
 * that Moyasar asks merchants to produce. So this is not decoration: the
 * footer, the contact page and the terms all read from here, and the number
 * must stay character-for-character as it appears on the وثيقة عمل حر.
 *
 * Contact channels live in `support.ts`; this file is identity only.
 */
export const BUSINESS = {
  /** وثيقة عمل حر — the licence the store trades under. */
  licenceNumber: "FL-288355247",

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
