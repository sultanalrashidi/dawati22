import type { ThemeConfig } from "@/lib/themes/types";

/**
 * The closed-envelope photo a hand-coded design opens with — the one image
 * that shows what a design actually looks like without opening a preview.
 *
 * The filenames and the folder fallback are the guest renderer's own (see
 * `sealed-card.tsx` for the two card styles, and `invitation-view.tsx` for the
 * fallback): bridal-frame art is stored as .webp and rose-emboss as .jpg.
 * Guessing either would show a broken tile for a design that renders fine.
 *
 * A theme with no `card` block is drawn in CSS rather than from photos, so it
 * has no envelope to show and the caller falls back to its palette.
 */
export function legacyThemeThumbnail(config: ThemeConfig): string | undefined {
  const style = config.card?.style;
  if (!style) return undefined;
  const folder = config.card?.assetFolder ?? "rose-candlelight";
  return `/themes/${folder}/${style === "rose-emboss" ? "envelope-closed.jpg" : "envelope-closed.webp"}`;
}
