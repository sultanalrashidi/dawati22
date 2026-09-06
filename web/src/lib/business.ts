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
} as const;
