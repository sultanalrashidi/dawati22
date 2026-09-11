"use client";

import { useEffect } from "react";
import { getImageProps } from "next/image";
import { resolveScene, type LayoutOverrides } from "@/lib/themes/builder/resolve";
import type { Breakpoint, LayoutDoc, SceneId, VariantPalette } from "@/lib/themes/builder/types";
import { STAGE_IMAGE_BOX, stageAssetUrl, stageImageSizes } from "@/components/themes/builder/theme-stage";

/**
 * Downloads the art of the screens a guest has not reached yet while she is
 * still looking at the sealed envelope, so that opening it shows the next
 * screen whole instead of an empty stage filling in.
 *
 * The screens after the cover only mount once the envelope opens, and their
 * images are lazy, so until now nothing was even requested before the tap —
 * the wait landed exactly on the moment of opening.
 *
 * Each image is asked for with the `srcset` and `sizes` the stage's own
 * <Image> will carry (the shared helpers in theme-stage.tsx), so the browser
 * picks the same file for this screen and finds it in its cache later. It
 * starts after the page's own `load` and at low priority, so it never competes
 * with the cover.
 */
export function SceneImageWarmer({
  layout,
  scenes,
  breakpoint,
  overrides,
  palette,
  assets,
  hasQr,
}: {
  layout: LayoutDoc;
  scenes: SceneId[];
  breakpoint: Breakpoint;
  overrides?: LayoutOverrides;
  palette: VariantPalette;
  assets: Record<string, string>;
  hasQr: boolean;
}) {
  // The cover re-renders while it animates; the scene list is rebuilt each
  // time, so it is keyed by value rather than by array identity.
  const scenesKey = scenes.join(",");

  useEffect(() => {
    const held: HTMLImageElement[] = [];
    let cancelled = false;

    const warm = () => {
      if (cancelled) return;
      const seen = new Set<string>();
      for (const scene of scenesKey.split(",").filter(Boolean)) {
        for (const entry of resolveScene(layout, scene, breakpoint, overrides, palette)) {
          if (entry.layer.type !== "asset") continue;
          const url = stageAssetUrl(entry.layer.slot, assets, hasQr);
          if (!url) continue;
          const { props } = getImageProps({
            src: url,
            alt: "",
            width: STAGE_IMAGE_BOX,
            height: STAGE_IMAGE_BOX,
            sizes: stageImageSizes(entry.transform.width),
          });
          const key = `${props.srcSet ?? props.src}|${props.sizes ?? ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const img = new Image();
          img.decoding = "async";
          img.fetchPriority = "low";
          // `sizes` before `srcset`, then `src` last: the candidate is chosen
          // when `src` is set, and it must be chosen with the other two known.
          if (props.sizes) img.sizes = props.sizes;
          if (props.srcSet) img.srcset = props.srcSet;
          img.src = props.src;
          // Held until the effect is torn down, so a pending download is not
          // collected along with an unreferenced element.
          held.push(img);
        }
      }
    };

    if (document.readyState === "complete") warm();
    else window.addEventListener("load", warm, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", warm);
      held.length = 0;
    };
  }, [scenesKey, layout, breakpoint, overrides, palette, assets, hasQr]);

  return null;
}
