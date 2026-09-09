import type { CoupleInput } from "@/lib/themes/builder/content";

/**
 * The event's own name, composed from the primary couple — groom first, as
 * everywhere the two are printed together.
 *
 * A draft never asks for an event name: "حفل زفاف فهد و نورة" is what she
 * would type anyway, and one fewer field stands between her and the preview.
 * The paid edit form and the admin form still expose the name, so a customer
 * or support can rename after activation.
 */
export function composeWeddingName(couples: readonly CoupleInput[]): string {
  const [couple] = couples;
  const groom = couple.groomNameAr?.trim() || couple.groomNameEn.trim();
  const bride = couple.brideNameAr?.trim() || couple.brideNameEn.trim();
  return `حفل زفاف ${groom} و ${bride}`;
}
