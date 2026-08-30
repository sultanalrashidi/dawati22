/**
 * Background art for the "rose-emboss" card family — the client's own
 * photo/render (hanging fringed lamp, candles and roses, floral damask),
 * used as-is per their direction, not the shared category decoration kit
 * every other theme uses (see theme-decor.tsx). Each color variant is the
 * same photo, recolored, living in its own /themes/{assetFolder}/ subfolder.
 */
import Image from "next/image";

/** Fixed, full-bleed cover photo sitting behind every scene in this theme. */
export function RoseCandlelightBackground({ assetFolder = "rose-candlelight" }: { assetFolder?: string }) {
  return (
    // `fill` positions the image `absolute`, so the viewport-fixed placement
    // moves to this wrapper. Same painted result, same stacking: a fixed box
    // with `z-0` is what the <img> itself used to be.
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <Image
        src={`/themes/${assetFolder}/background.jpg`}
        alt=""
        fill
        // `object-cover` CROPS, so the file has to be bigger than the box it
        // fills: the width the screen really needs is the larger of the
        // viewport's own width and the width this photo reaches once it has
        // been scaled tall enough to cover. Every one of these backgrounds is
        // portrait at roughly 2:3, so on anything narrower than that it is
        // height that binds and the honest answer is 67vh, not 100vw — which
        // would under-serve a phone by a third and show it a soft backdrop.
        sizes="(max-aspect-ratio: 2/3) 67vh, 100vw"
        // The first thing painted on the guest's screen, behind the sealed
        // card. Lazy-loading it would leave the invitation opening over a
        // blank colour.
        priority
        className="object-cover"
      />
    </div>
  );
}
