/**
 * Normalizes Saudi mobile numbers to E.164 (+9665XXXXXXXX).
 * Accepts local (05XXXXXXXX), bare (5XXXXXXXX), or already-E.164 input.
 * Returns null if the number doesn't look like a valid Saudi mobile number.
 */
export function normalizeSaudiPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");

  let national: string | null = null;
  if (/^\+9665\d{8}$/.test(digits)) {
    return digits;
  }
  if (/^9665\d{8}$/.test(digits)) {
    return `+${digits}`;
  }
  if (/^05\d{8}$/.test(digits)) {
    national = digits.slice(1);
  } else if (/^5\d{8}$/.test(digits)) {
    national = digits;
  }

  if (!national) return null;
  return `+966${national}`;
}
