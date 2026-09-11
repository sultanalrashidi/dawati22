import type { ThemeConfig } from "@/lib/themes/types";
import type { GuestBuilderTheme } from "@/lib/themes/builder/guest";
import { sceneCanvas, type AssetLayer, type Transform } from "@/lib/themes/builder/types";

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

/**
 * A closed envelope that has to be cut out of its photograph before a tile can
 * show it. Everything here is the guest page's own geometry, so the tile and
 * the invitation's first screen agree.
 */
export interface EnvelopeCutout {
  /** CSS `clip-path` for the image, straight from the layer's `clipPolygon`. */
  clipPath: string;
  fit: AssetLayer["fit"];
  /** The envelope layer's box inside its scene, centre-anchored as the stage places it. */
  box: Transform & { height: number };
  /** The scene canvas, width over height. */
  canvasAspect: number;
  /** What shows through where the photograph was cut away: the design's page backdrop. */
  backdrop: { url?: string; color: string; overlayColor: string; overlayOpacity: number };
}

/**
 * The closed-envelope art a builder design's tile leads with.
 *
 * Most envelope photographs are full-bleed, so the tile covers itself with
 * them. A design whose envelope layer carries a `clipPolygon` (حمام الوصل) has
 * backdrop painted into the photograph around the envelope, a grey
 * checkerboard. The guest page cuts it away and the design's background shows
 * through, and the tile has to do the same or it advertises the checkerboard.
 */
export function builderThemeThumbnail(builder: GuestBuilderTheme | undefined): {
  url?: string;
  cutout?: EnvelopeCutout;
} {
  if (!builder) return {};
  const { assets, layout, palette } = builder;
  // The closed envelope is what a guest sees first; the other two only stand
  // in for a design that has not uploaded one yet.
  const url = assets.envelopeClosed ?? assets.background ?? assets.card;
  const layer = assets.envelopeClosed
    ? layout.layers.find(
        (l): l is AssetLayer => l.type === "asset" && l.slot === "envelopeClosed" && (l.clipPolygon?.length ?? 0) > 0,
      )
    : undefined;
  // An auto-height box takes its height from the image, which the tile cannot
  // know before it loads — such a design keeps the plain photograph.
  if (!layer?.clipPolygon || layer.base.height === null) return { url };
  const canvas = sceneCanvas(layout, layer.scene);
  return {
    url,
    cutout: {
      clipPath: `polygon(${layer.clipPolygon.map((p) => `${p.x}% ${p.y}%`).join(",")})`,
      fit: layer.fit,
      box: { ...layer.base, height: layer.base.height },
      canvasAspect: canvas.aspectW / canvas.aspectH,
      backdrop: {
        url: layout.page.slot ? assets[layout.page.slot] : undefined,
        color: palette.bg,
        overlayColor: layout.page.overlayColor,
        overlayOpacity: layout.page.overlayOpacity,
      },
    },
  };
}
