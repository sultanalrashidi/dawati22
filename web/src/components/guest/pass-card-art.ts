/**
 * The pixel size of each variant's printed entry-pass artwork.
 *
 * WHY THIS EXISTS. The pass card used to size itself the way any plain <img>
 * does — from the file's own pixels, capped by the scene's width and a share
 * of the viewport height. That works exactly until the image becomes
 * responsive: a browser reports a responsive image's intrinsic width as the
 * SERVED file's width divided by the density it picked, and the optimiser
 * never upscales past the source, so a card whose art is 800px wide reports
 * 400 on a retina screen and 267 on a three-times one. Anything sizing itself
 * from that shrinks with it — and on this card the guest's name, the venue
 * line and the window the QR has to sit inside are all positioned as
 * percentages of the image, so the whole printed layout would shrink out of
 * its own frame. It was measured at 320px where it should have been 478.
 *
 * With the proportions stated here the card's width is computed in CSS and
 * the image simply fills it, so nothing reads an intrinsic size at all.
 *
 * WHEN A DESIGN IS ADDED. Add its folder. A folder that is missing falls back
 * to its family's base art, and the consequence is bounded and visible rather
 * than subtle: the image still renders at its OWN proportions — it can never
 * be stretched by a wrong number here — the card may simply run a little
 * taller or shorter than the height cap intends.
 */

export interface PassCardArt {
  width: number;
  height: number;
}

/** ivory-bloom, the base art every bridal-frame variant is cut from. */
export const BRIDAL_FRAME_PASS_ART: PassCardArt = { width: 800, height: 1200 };

/** Every rose-emboss variant is the same photograph, recolored. */
export const ROSE_EMBOSS_PASS_ART: PassCardArt = { width: 1054, height: 1492 };

const PASS_CARD_ART: Record<string, PassCardArt> = {
  "champagne-tassel": { width: 1086, height: 1448 },
  "gilded-tassel": { width: 1054, height: 1493 },
  "ivory-bloom": { width: 800, height: 1200 },
  "ivory-bloom-burgundy": { width: 675, height: 1200 },
  "ivory-bloom-mauve": { width: 800, height: 1200 },
  "ivory-bloom-mocha": { width: 675, height: 1200 },
  "ivory-bloom-navy": { width: 675, height: 1200 },
  "ivory-bloom-rose": { width: 800, height: 1200 },
  "ivory-bloom-sage": { width: 800, height: 1200 },
  "ivory-bloom-sand": { width: 800, height: 1200 },
  "ivory-bloom-sky": { width: 800, height: 1200 },
  "marble-bloom": { width: 1024, height: 1536 },
  "pearl-lace": { width: 1086, height: 1448 },
  "pearl-lace-black": { width: 1086, height: 1448 },
  "pearl-lace-blush": { width: 1086, height: 1448 },
  "pearl-lace-champagne": { width: 1086, height: 1448 },
  "pearl-lace-sage": { width: 1086, height: 1448 },
  "porcelain-seal": { width: 1023, height: 1537 },
  "ribbon-bloom": { width: 1024, height: 1536 },
  "rose-blush": { width: 1054, height: 1492 },
  "rose-candlelight": { width: 1054, height: 1492 },
  "rose-charcoal": { width: 1054, height: 1492 },
  "rose-emerald": { width: 1054, height: 1492 },
  "rose-navy": { width: 1054, height: 1492 },
  "rose-purple": { width: 1054, height: 1492 },
  "sapphire-bloom": { width: 1086, height: 1448 },
};

export function passCardArt(assetFolder: string, fallback: PassCardArt): PassCardArt {
  return PASS_CARD_ART[assetFolder] ?? fallback;
}

/**
 * The card's width, as CSS.
 *
 * It is the smaller of the room the scene leaves and the width this art
 * reaches at the height cap — the same two bounds `max-width` and `max-height`
 * used to apply to the image, moved onto the box so they are settled before
 * any file arrives rather than after.
 */
export function passCardWidth(art: PassCardArt, maxHeight: string): string {
  return `min(100%, calc(${maxHeight} * ${art.width} / ${art.height}))`;
}
