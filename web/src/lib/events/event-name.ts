import type { CoupleInput } from "@/lib/themes/builder/content";

/**
 * The event's own name, composed from the primary couple — groom first, as
 * everywhere the two are printed together.
 *
 * A draft never asks for an event name: "حفل زفاف فهد و نورة" is what she
 * would type anyway, and one fewer field stands between her and the preview.
 */
export function composeWeddingName(couples: readonly CoupleInput[]): string {
  const [couple] = couples;
  const groom = couple.groomNameAr?.trim() || couple.groomNameEn.trim();
  const bride = couple.brideNameAr?.trim() || couple.brideNameEn.trim();
  return `حفل زفاف ${groom} و ${bride}`;
}

/**
 * The name a submitted form saves — composed for a wedding, typed for anything
 * else.
 *
 * A wedding is named after its couple at every door: the draft page, the create
 * form, the customer's edit and support's. It used to be composed on the draft
 * page alone and typed into a field of its own on the other three, and a field
 * is a copy: correcting the groom's name in the admin rewrote him on the
 * invitation, in the share text and on the seal, while `name` kept the name he
 * was entered under. The two places that print `name` rather than the couple —
 * the calendar file's SUMMARY and the wallet pass's "المناسبة" — then went on
 * naming a man the wedding was no longer for.
 *
 * Other occasions keep what was typed: "حفل زفاف" is not a graduation.
 */
export function eventNameFor({
  isWedding,
  couples,
  typed,
}: {
  isWedding: boolean;
  couples: readonly CoupleInput[];
  typed: string;
}): string {
  if (isWedding && couples.length > 0) return composeWeddingName(couples);
  return typed;
}
