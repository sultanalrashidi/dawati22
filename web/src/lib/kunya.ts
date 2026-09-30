/**
 * Keep a kunya on one line: "أم عبدالله", never "أم" at the end of one line
 * and "عبدالله" at the start of the next.
 *
 * A mother is named by her kunya on every invitation — twice in the host line,
 * and often as the guest the card greets — and on a 390px phone the line broke
 * right after "أم" unless the host happened to type a no-break space, which
 * no one does. So the renderer binds the prefix to the name that follows with
 * U+00A0 as it prints it. The stored text is never rewritten: this is for
 * display only, and anything that posts a name back (the RSVP form's prefill)
 * must keep reading the raw value.
 *
 * The prefix must be a whole word — start of text or after a non-letter, then
 * a space — so "أمل", "أمين" and "الإمام" are untouched. It may carry tashkeel
 * ("أُمّ فهد"), drop its hamza the way people type ("ام فهد", "ابو فهد"), and
 * lead with an attached "و" ("وأم سعد") as a free host line does. A following
 * "عبد" written apart ("أم عبد الله") is bound to its own name too, or the
 * line would only move the break one word along.
 *
 * Only ordinary spaces are replaced. A line break the host typed stays hers,
 * and the result stays one string of the same words, so FittedText measures
 * it as before; `\s` still matches U+00A0, so a flattener that collapses
 * `\s+` to " " (the WhatsApp text) turns it back into a plain space.
 *
 * The word boundary is a captured character rather than a lookbehind: Safari
 * before 16.4 rejects lookbehind when it parses the script, which would take
 * the whole invitation down on an older iPhone.
 */
const KUNYA = /(^|[^\p{L}\p{M}\p{N}])((?:و\p{M}*)?[أا]\p{M}*(?:م|ب\p{M}*[واي])\p{M}*) +((?:عبد\p{M}* +)?)(?=\p{L})/gu;

const NO_BREAK_SPACE = "\u00A0";

export function bindKunyas(text: string): string {
  return text.replace(
    KUNYA,
    (_match, before: string, prefix: string, abd: string) =>
      `${before}${prefix}${NO_BREAK_SPACE}${abd.replace(/ +$/, NO_BREAK_SPACE)}`,
  );
}
