/**
 * How long a verification code is.
 *
 * A range, not a number, because the two providers disagree and only one of
 * them is ours to decide. The mock generates six digits; Authentica generates
 * its own, and its length comes from whichever SMS template the account has
 * approved in their dashboard — four digits on this account. Hard-coding six in
 * the form is what made a correctly delivered code impossible to submit.
 *
 * The range is only a guard against empty and absurd input. What actually
 * decides whether a code is right is the stored hash or the provider, and
 * neither cares what the form thought the length should be.
 *
 * No `server-only` and no imports on purpose: the form enforcing it runs in the
 * browser and the generator runs on the server.
 */
export const OTP_MIN_LENGTH = 4;
export const OTP_MAX_LENGTH = 8;

/** The length this codebase generates when it owns the code (the mock). */
export const OTP_GENERATED_LENGTH = 6;

/** Long enough to be worth submitting. Not a claim that it is correct. */
export function isSubmittableOtp(code: string): boolean {
  return code.length >= OTP_MIN_LENGTH && code.length <= OTP_MAX_LENGTH;
}
