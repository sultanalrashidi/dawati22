/**
 * The full-page backdrop of a BUILDER theme.
 *
 * A builder theme's art used to be an ordinary asset layer, which meant it
 * lived inside one scene's fixed-aspect stage: it showed on the cover and then
 * vanished on every scene after it. `LayoutDoc.page` hoists it out of the
 * layer list, and this component paints it the way the customer asked for —
 * fixed, full-bleed, behind the entire invitation, on every scene.
 *
 * Modelled on `rose-candlelight-decor.tsx`, which does the same job for the
 * hand-coded rose-emboss card family.
 */
import type { PageBackground } from "@/lib/themes/builder/types";

/**
 * The image `page` points at for this variant, or `null` when the theme has no
 * page background at all — slot cleared by the admin, or nothing uploaded into
 * it yet. Callers use `null` to mean "keep the flat palette colour".
 */
export function pageBackgroundUrl(
  page: PageBackground,
  assets: Record<string, string>,
): string | null {
  if (!page.slot) return null;
  return assets[page.slot] ?? null;
}

/**
 * Renders nothing when the slot resolves to no url, so a theme that never set
 * a background keeps the flat `--color-bg` it has today.
 */
export function BuilderPageBackground({
  page,
  assets,
}: {
  page: PageBackground;
  assets: Record<string, string>;
}) {
  const url = pageBackgroundUrl(page, assets);
  if (!url) return null;

  return (
    <>
      {/* `fixed inset-0` (not absolute) so it stays put while the scene
          container scrolls through its snap points, and `z-0` so it sits above
          the wrapper's flat background colour but below every positioned
          descendant that follows it in the tree. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-0 h-full w-full ${
          page.fit === "contain" ? "object-contain" : "object-cover"
        }`}
      />
      {/* Optional tint for holding text legible over busy art. */}
      {page.overlayOpacity > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0"
          style={{ background: page.overlayColor, opacity: page.overlayOpacity }}
        />
      )}
    </>
  );
}
