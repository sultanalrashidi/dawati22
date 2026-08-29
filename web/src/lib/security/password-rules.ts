/**
 * The password rule, and nothing else.
 *
 * Split out from `password.ts` because the form that enforces it runs in the
 * browser and that file imports `node:crypto` — pulling the hashing module into
 * a client component shipped a shimmed `scrypt` and crashed the page on load.
 * Same reasoning as `lib/orders/pricing.ts`: the rule both sides share lives
 * where both sides can reach it.
 */
export const MIN_PASSWORD_LENGTH = 10;

export function isAcceptablePassword(password: string): boolean {
  return password.trim().length >= MIN_PASSWORD_LENGTH;
}
