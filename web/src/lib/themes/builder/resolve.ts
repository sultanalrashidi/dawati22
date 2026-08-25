/**
 * Turns a stored layout plus one variant into the flat list a stage renders.
 * Shared by the guest renderer and the editor so both agree on geometry to the
 * pixel — the editor is not a second implementation that can drift.
 */

import {
  layersForScene,
  resolveTransform,
  type Breakpoint,
  type Layer,
  type LayoutDoc,
  type SceneId,
  type Transform,
  type TransformOverride,
} from "@/lib/themes/builder/types";

export interface ResolvedLayer {
  layer: Layer;
  transform: Transform;
}

/** Sparse per-variant tweaks, keyed by layer id. Usually absent. */
export type LayoutOverrides = Record<string, TransformOverride | undefined>;

export function parseLayoutOverrides(raw: unknown): LayoutOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as LayoutOverrides;
}

export function resolveScene(
  doc: LayoutDoc,
  scene: SceneId,
  breakpoint: Breakpoint,
  overrides: LayoutOverrides = {},
): ResolvedLayer[] {
  return layersForScene(doc, scene)
    .filter((layer) => layer.visible)
    // The page background is painted full-bleed behind every scene, so an
    // asset layer pointing at the same slot would draw it a second time,
    // cropped to this scene's stage.
    .filter((layer) => !(layer.type === "asset" && doc.page.slot !== null && layer.slot === doc.page.slot))
    .map((layer) => {
      const transform = resolveTransform(layer, breakpoint);
      const variantOverride = overrides[layer.id];
      return {
        layer,
        transform: variantOverride ? { ...transform, ...stripUndefined(variantOverride) } : transform,
      };
    });
}

function stripUndefined<T extends object>(source: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** slot → url map for one variant, falling back to the theme-wide assets. */
export function buildAssetMap(
  assets: { slot: string; url: string; variantId: string | null }[],
  variantId: string | null,
): Record<string, string> {
  const map: Record<string, string> = {};
  // Shared assets first so a variant-specific image wins the same slot.
  for (const asset of assets) {
    if (asset.variantId === null) map[asset.slot] = asset.url;
  }
  if (variantId) {
    for (const asset of assets) {
      if (asset.variantId === variantId) map[asset.slot] = asset.url;
    }
  }
  return map;
}
