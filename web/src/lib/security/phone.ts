/**
 * Phone numbers the sign-in form accepts.
 *
 * Sign-in used to be Saudi-only. It now offers a country picker covering the
 * Gulf and the wider Arab region, with Saudi Arabia as the default — so the
 * registry below is the single source of truth shared by the picker UI (client)
 * and the server actions that validate what the picker sent. Keep it free of
 * server-only imports for that reason.
 *
 * `national` matches the SUBSCRIBER number only — after the international code
 * and any national trunk `0` have been peeled off. We check length and the
 * leading digit, which rejects the common typo without pretending to know every
 * live prefix each operator has ever issued (being too strict turns a valid
 * customer away; the code they never receive is the backstop for a bogus one).
 */
export type PhoneRegion = "gulf" | "arab";

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2. Also the picker's option value and React key. */
  iso: string;
  /** International dialing code, without the leading `+`. */
  dialCode: string;
  flag: string;
  nameAr: string;
  nameEn: string;
  /** The national (subscriber) number, trunk `0` already removed. */
  national: RegExp;
  /** A format hint shown as the input placeholder. */
  example: string;
  region: PhoneRegion;
}

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  // Gulf — Saudi first, the default.
  { iso: "SA", dialCode: "966", flag: "🇸🇦", nameAr: "السعودية", nameEn: "Saudi Arabia", national: /^5\d{8}$/, example: "5X XXX XXXX", region: "gulf" },
  { iso: "AE", dialCode: "971", flag: "🇦🇪", nameAr: "الإمارات", nameEn: "United Arab Emirates", national: /^5\d{8}$/, example: "5X XXX XXXX", region: "gulf" },
  { iso: "KW", dialCode: "965", flag: "🇰🇼", nameAr: "الكويت", nameEn: "Kuwait", national: /^[569]\d{7}$/, example: "XXXX XXXX", region: "gulf" },
  { iso: "QA", dialCode: "974", flag: "🇶🇦", nameAr: "قطر", nameEn: "Qatar", national: /^[3567]\d{7}$/, example: "XXXX XXXX", region: "gulf" },
  { iso: "BH", dialCode: "973", flag: "🇧🇭", nameAr: "البحرين", nameEn: "Bahrain", national: /^[36]\d{7}$/, example: "XXXX XXXX", region: "gulf" },
  { iso: "OM", dialCode: "968", flag: "🇴🇲", nameAr: "عُمان", nameEn: "Oman", national: /^[79]\d{7}$/, example: "XXXX XXXX", region: "gulf" },
  // Wider Arab region.
  { iso: "EG", dialCode: "20", flag: "🇪🇬", nameAr: "مصر", nameEn: "Egypt", national: /^1\d{9}$/, example: "1XX XXX XXXX", region: "arab" },
  { iso: "JO", dialCode: "962", flag: "🇯🇴", nameAr: "الأردن", nameEn: "Jordan", national: /^7\d{8}$/, example: "7X XXX XXXX", region: "arab" },
  { iso: "IQ", dialCode: "964", flag: "🇮🇶", nameAr: "العراق", nameEn: "Iraq", national: /^7\d{9}$/, example: "7XX XXX XXXX", region: "arab" },
  { iso: "LB", dialCode: "961", flag: "🇱🇧", nameAr: "لبنان", nameEn: "Lebanon", national: /^\d{7,8}$/, example: "XX XXX XXX", region: "arab" },
  { iso: "PS", dialCode: "970", flag: "🇵🇸", nameAr: "فلسطين", nameEn: "Palestine", national: /^5\d{8}$/, example: "5X XXX XXXX", region: "arab" },
  { iso: "SY", dialCode: "963", flag: "🇸🇾", nameAr: "سوريا", nameEn: "Syria", national: /^9\d{8}$/, example: "9XX XXX XXX", region: "arab" },
  { iso: "YE", dialCode: "967", flag: "🇾🇪", nameAr: "اليمن", nameEn: "Yemen", national: /^7\d{8}$/, example: "7XX XXX XXX", region: "arab" },
  { iso: "SD", dialCode: "249", flag: "🇸🇩", nameAr: "السودان", nameEn: "Sudan", national: /^[19]\d{8}$/, example: "9X XXX XXXX", region: "arab" },
  { iso: "LY", dialCode: "218", flag: "🇱🇾", nameAr: "ليبيا", nameEn: "Libya", national: /^9\d{8}$/, example: "9X XXX XXXX", region: "arab" },
  { iso: "DZ", dialCode: "213", flag: "🇩🇿", nameAr: "الجزائر", nameEn: "Algeria", national: /^[567]\d{8}$/, example: "5XX XX XX XX", region: "arab" },
  { iso: "MA", dialCode: "212", flag: "🇲🇦", nameAr: "المغرب", nameEn: "Morocco", national: /^[67]\d{8}$/, example: "6XX XX XX XX", region: "arab" },
  { iso: "TN", dialCode: "216", flag: "🇹🇳", nameAr: "تونس", nameEn: "Tunisia", national: /^\d{8}$/, example: "XX XXX XXX", region: "arab" },
];

/** The default country the picker opens on. */
export const DEFAULT_PHONE_COUNTRY = "SA";

export function getPhoneCountry(iso: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.iso === iso);
}

/**
 * Normalizes a typed number to E.164 (`+<code><subscriber>`) for the chosen
 * country, or returns null when it does not look like a mobile number there.
 *
 * The customer may type the number many ways — bare subscriber (`512345678`),
 * with a trunk zero (`0512345678`), or fully international with the code
 * (`+966512345678`, `00966512345678`). We build each plausible reading and keep
 * the first that matches the country's pattern; a wrong peel simply fails the
 * pattern and the next reading is tried, so the code stays the only authority.
 */
export function normalizePhone(input: string, iso: string): string | null {
  const country = getPhoneCountry(iso);
  if (!country) return null;

  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // international access prefix

  const stripTrunk = (s: string) => s.replace(/^0+/, "");
  const candidates: string[] = [];
  if (digits.startsWith(country.dialCode)) {
    candidates.push(stripTrunk(digits.slice(country.dialCode.length)));
  }
  candidates.push(stripTrunk(digits));

  for (const national of candidates) {
    if (country.national.test(national)) return `+${country.dialCode}${national}`;
  }
  return null;
}

/**
 * Saudi-only normalization, kept for the private admin sign-in — admins are the
 * business owner and always Saudi, so that security-sensitive path deliberately
 * does not widen to the customer picker's country list.
 */
export function normalizeSaudiPhone(input: string): string | null {
  return normalizePhone(input, "SA");
}

/** Arabic-Indic and Eastern-Arabic digits to ASCII — `\D` above is ASCII-only. */
function asciiDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Longest code first, so a code can never be shadowed by a shorter one it starts with. */
const BY_DIAL_CODE_LENGTH = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

/**
 * A guest's number, however the host wrote it.
 *
 * Saudi is the default reading, so every shape a Saudi list arrives in — 05…,
 * 5…, 9665…, +9665…, 009665… — lands on +9665…. A number from anywhere else
 * says where it is from: `+965…`, `00965…` or `965…` for a country in the list
 * above, checked against that country's own pattern — or, for a country not in
 * the list, the full number after a `+` or `00`, taken as written.
 *
 * A bare local number from abroad is never guessed at: `011…` is an Egyptian
 * mobile and also Riyadh's landline code, and an eight-digit `5xxxxxxx` could
 * be Kuwaiti or Qatari. A wrong guess puts an invitation in a stranger's chat.
 *
 * `listedOnly` drops the unlisted-country reading, for callers that use a
 * successful parse as evidence (the import's seat-count back-off), where only a
 * country's own pattern is strict enough to trust.
 */
export function normalizeGuestPhone(
  input: string,
  { listedOnly = false }: { listedOnly?: boolean } = {},
): string | null {
  const text = asciiDigits(input);
  const saudi = normalizePhone(text, DEFAULT_PHONE_COUNTRY);
  if (saudi) return saudi;

  const explicit = /^\s*(\+|00)/.test(text);
  let digits = text.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  const country = BY_DIAL_CODE_LENGTH.find((c) => digits.startsWith(c.dialCode));
  if (country) {
    const national = digits.slice(country.dialCode.length).replace(/^0+/, "");
    return country.national.test(national) ? `+${country.dialCode}${national}` : null;
  }
  // E.164 allows at most fifteen digits; eight is the shortest full number in use.
  if (!listedOnly && explicit && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}
