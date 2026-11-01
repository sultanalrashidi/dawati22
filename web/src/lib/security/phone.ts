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
export type PhoneRegion = "gulf" | "arab" | "world";

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

/**
 * Every other country, as `ISO:code` pairs. Names come from the runtime's own
 * region names and the flag from the ISO letters, so the list stays one line
 * per region instead of two hundred hand-kept rows.
 *
 * A few countries our customers often live in get their real mobile pattern;
 * the rest take any 6+ digit subscriber that keeps the whole number within
 * E.164's fifteen digits — the code they never receive is the backstop.
 */
const WORLD = [
  // Europe
  "DE:49 GB:44 FR:33 IT:39 ES:34 PT:351 NL:31 BE:32 LU:352 CH:41 AT:43 IE:353 DK:45 SE:46 NO:47 FI:358 IS:354 PL:48",
  "CZ:420 SK:421 HU:36 RO:40 BG:359 GR:30 CY:357 MT:356 HR:385 SI:386 RS:381 BA:387 ME:382 MK:389 AL:355 XK:383",
  "EE:372 LV:371 LT:370 UA:380 BY:375 MD:373 RU:7 GE:995 AM:374 AZ:994 TR:90 MC:377 LI:423 AD:376 SM:378",
  // Americas
  "US:1 CA:1 MX:52 BR:55 AR:54 CL:56 CO:57 PE:51 VE:58 EC:593 BO:591 PY:595 UY:598 GT:502 SV:503 HN:504 NI:505",
  "CR:506 PA:507 CU:53 DO:1 JM:1 TT:1 BS:1 BB:1 PR:1 HT:509 GY:592 SR:597 BZ:501",
  // Asia and Oceania
  "IN:91 PK:92 BD:880 LK:94 NP:977 AF:93 IR:98 CN:86 HK:852 MO:853 TW:886 JP:81 KR:82 MN:976 SG:65 MY:60 ID:62",
  "TH:66 VN:84 PH:63 KH:855 LA:856 MM:95 BN:673 MV:960 KZ:7 UZ:998 TM:993 KG:996 TJ:992 AU:61 NZ:64 FJ:679 PG:675",
  // Africa
  "MR:222 SO:252 DJ:253 KM:269 NG:234 GH:233 KE:254 ET:251 TZ:255 UG:256 RW:250 ZA:27 ZW:263 ZM:260 MW:265 MZ:258",
  "AO:244 CM:237 CI:225 SN:221 ML:223 NE:227 TD:235 BF:226 GN:224 BJ:229 TG:228 SL:232 LR:231 GM:220 ER:291 SS:211",
  "CD:243 CG:242 GA:241 GQ:240 MG:261 MU:230 SC:248 NA:264 BW:267 LS:266 SZ:268 CV:238 BI:257",
].join(" ");

const WORLD_PATTERNS: Record<string, { national: RegExp; example: string }> = {
  DE: { national: /^1[5-7]\d{8,9}$/, example: "15X XXXXXXXX" },
  GB: { national: /^7\d{9}$/, example: "7XXX XXXXXX" },
  FR: { national: /^[67]\d{8}$/, example: "6 XX XX XX XX" },
  NL: { national: /^6\d{8}$/, example: "6 XXXXXXXX" },
  IT: { national: /^3\d{8,9}$/, example: "3XX XXX XXXX" },
  ES: { national: /^[67]\d{8}$/, example: "6XX XXX XXX" },
  TR: { national: /^5\d{9}$/, example: "5XX XXX XXXX" },
  US: { national: /^[2-9]\d{9}$/, example: "XXX XXX XXXX" },
  CA: { national: /^[2-9]\d{9}$/, example: "XXX XXX XXXX" },
  AU: { national: /^4\d{8}$/, example: "4XX XXX XXX" },
  IN: { national: /^[6-9]\d{9}$/, example: "XXXXX XXXXX" },
  PK: { national: /^3\d{9}$/, example: "3XX XXXXXXX" },
};

function worldCountries(): PhoneCountry[] {
  const names = (locale: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return null;
    }
  };
  const ar = names("ar");
  const en = names("en");
  return WORLD.split(" ").map((pair) => {
    const [iso, dialCode] = pair.split(":");
    const known = WORLD_PATTERNS[iso];
    return {
      iso,
      dialCode,
      flag: String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0))),
      nameAr: ar?.of(iso) ?? iso,
      nameEn: en?.of(iso) ?? iso,
      national: known?.national ?? new RegExp(`^[1-9]\\d{5,${14 - dialCode.length}}$`),
      example: known?.example ?? "XXXXXXXXX",
      region: "world" as const,
    };
  });
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
  // The rest of the world, for customers living abroad (Germany, the UK, …).
  ...worldCountries(),
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

/**
 * The Gulf and Arab countries — the ones whose own mobile pattern is strict
 * enough to read a number by its code alone. The "world" rows are loose by
 * design, so guest-number reading and admin search keep to these.
 */
export const LISTED_PHONE_COUNTRIES = PHONE_COUNTRIES.filter((c) => c.region !== "world");

/** Longest code first, so a code can never be shadowed by a shorter one it starts with. */
const BY_DIAL_CODE_LENGTH = [...LISTED_PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

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
