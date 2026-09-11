import Image from "next/image";
import type { EnvelopeCutout } from "@/lib/themes/thumbnail";

/**
 * A design's closed envelope, filling a tile (the caller's positioned box).
 *
 * A full-bleed photograph is simply covered into the tile. A cut-out one (see
 * `builderThemeThumbnail`) is laid out the way the guest page lays out its
 * cover scene: the design's backdrop behind, the scene canvas contained in the
 * tile, and the envelope layer in its own box with its silhouette clipped. So
 * the tile never shows the backdrop painted into the photograph.
 */
export function EnvelopeThumbnail({
  url,
  cutout,
  sizes,
  tileAspect,
}: {
  url: string;
  cutout?: EnvelopeCutout;
  sizes: string;
  /** The tile's width over height. */
  tileAspect: number;
}) {
  if (!cutout) return <Image src={url} alt="" fill sizes={sizes} className="object-cover" />;

  const { backdrop, box, canvasAspect } = cutout;
  const wide = canvasAspect >= tileAspect;
  return (
    <>
      <span aria-hidden="true" className="absolute inset-0" style={{ background: backdrop.color }} />
      {backdrop.url && <Image src={backdrop.url} alt="" fill sizes={sizes} className="object-cover" />}
      {backdrop.overlayOpacity > 0 && (
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: backdrop.overlayColor, opacity: backdrop.overlayOpacity }}
        />
      )}
      {/* The scene canvas, contained in the tile as the stage contains it in a screen. */}
      <span
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: wide ? "100%" : `${(canvasAspect / tileAspect) * 100}%`,
          height: wide ? `${(tileAspect / canvasAspect) * 100}%` : "100%",
        }}
      >
        <span
          className="absolute"
          style={{
            left: `${box.x}%`,
            top: `${box.y}%`,
            width: `${box.width}%`,
            height: `${box.height}%`,
            transform: `translate(-50%, -50%) rotate(${box.rotation}deg) scale(${box.scale})`,
            opacity: box.opacity,
          }}
        >
          <Image src={url} alt="" fill sizes={sizes} style={{ objectFit: cutout.fit, clipPath: cutout.clipPath }} />
        </span>
      </span>
    </>
  );
}
