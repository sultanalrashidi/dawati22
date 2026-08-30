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
import Image from "next/image";
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
          descendant that follows it in the tree. It moved off the image and
          onto this wrapper because `fill` positions the image `absolute`;
          nothing about what gets painted changed. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <Image
          src={url}
          alt=""
          fill
          // An admin uploads whatever proportions they like here, so unlike
          // the hand-coded backgrounds there is no aspect ratio to reason
          // from — and `cover` crops, which means a phone can need more width
          // than it has. 100vw is the honest floor for `contain` and a slight
          // under-ask for `cover`; the optimiser never serves more than the
          // file holds, so on artwork narrower than that it costs nothing.
          sizes="100vw"
          // Painted behind every scene from the first frame — see the
          // rose-emboss background for why this is not lazy.
          priority
          className={page.fit === "contain" ? "object-contain" : "object-cover"}
        />
      </div>
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
