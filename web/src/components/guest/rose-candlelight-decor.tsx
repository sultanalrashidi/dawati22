/**
 * Background art for the "rose-emboss" card family — the client's own
 * photo/render (hanging fringed lamp, candles and roses, floral damask),
 * used as-is per their direction, not the shared category decoration kit
 * every other theme uses (see theme-decor.tsx). Each color variant is the
 * same photo, recolored, living in its own /themes/{assetFolder}/ subfolder.
 */

/** Fixed, full-bleed cover photo sitting behind every scene in this theme. */
export function RoseCandlelightBackground({ assetFolder = "rose-candlelight" }: { assetFolder?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/themes/${assetFolder}/background.jpg`}
      alt=""
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full object-cover"
    />
  );
}
