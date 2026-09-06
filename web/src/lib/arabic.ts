/**
 * Matching Arabic names the way people actually type them.
 *
 * At a door, an organiser types "ام فهد" for a guest saved as "أُمّ فهد" and
 * expects to find her. Arabic makes that a real problem rather than a nicety:
 * the hamza forms (أ إ آ) are routinely dropped, ة and ه are interchanged in
 * casual typing, ى and ي likewise, and vowel marks may or may not be there.
 * A plain `contains` finds none of it, and a guest who cannot be found at the
 * door is a guest standing outside.
 *
 * Folding both sides through this before comparing is the whole trick. It is
 * deliberately lossy — it is for matching, never for display.
 */

/** Combining marks: tashkeel, plus the tatweel used to stretch a word. */
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Arabic-Indic and extended Arabic-Indic digits, in order 0–9. */
const DIGIT_BASES = [0x0660, 0x06f0];

export function normalizeArabic(input: string): string {
  let text = input.normalize("NFKC").replace(MARKS, "");

  text = text
    .replace(/[أإآٱٲٳٵ]/g, "ا")
    .replace(/[ىیۍ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ء/g, "");

  // Arabic-Indic digits fold to Latin ones so "٠٥٠" and "050" are one string.
  text = text.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.codePointAt(0)!;
    const base = DIGIT_BASES.find((b) => code >= b && code <= b + 9)!;
    return String(code - base);
  });

  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Whether `needle` appears in `haystack` once both are folded. */
export function arabicIncludes(haystack: string, needle: string): boolean {
  const n = normalizeArabic(needle);
  return n.length > 0 && normalizeArabic(haystack).includes(n);
}
