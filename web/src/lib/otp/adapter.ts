/**
 * How a code reaches a phone, and who decides whether it was right.
 *
 * Two shapes, because the two providers genuinely differ:
 *
 *  - The mock generates nothing: it echoes back the code WE made, and this
 *    codebase verifies it against its own hash.
 *  - Authentica's v2 API generates its OWN code. `/send-otp` takes a method, a
 *    phone and a template and nothing else — there is no field for supplying a
 *    code — and `/verify-otp` is what says whether the customer typed it
 *    correctly. An adapter in that position sets `ownsCode` and implements
 *    `verifyOtp`, and the local hash is never consulted for it.
 *
 * The OtpCode row is written either way. It is what rate-limits sending,
 * expires the attempt and counts wrong guesses — none of which the provider
 * does for us, and all of which we would lose by treating "the provider owns
 * the code" as "the provider owns the flow".
 */
export interface OtpAdapter {
  /**
   * Delivers a code to `phone`. `code` is the one this codebase generated; an
   * adapter that owns its own code ignores it.
   * Returns a dev-only echo when running mocked.
   */
  sendOtp(phone: string, code: string): Promise<{ devCode?: string }>;

  /**
   * True when the provider generated the code, so `verifyOtp` — not the stored
   * hash — is the authority on whether a submitted code is right.
   */
  ownsCode?: boolean;

  /** Required when `ownsCode` is true. Asks the provider to check the code. */
  verifyOtp?(phone: string, code: string): Promise<boolean>;
}

export class OtpDeliveryError extends Error {}
