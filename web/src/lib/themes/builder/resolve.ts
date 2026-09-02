/**
 * Turns a stored layout plus one variant into the flat list a stage renders.
 * Shared by the guest renderer and the editor so both agree on geometry to the
 * pixel — the editor is not a second implementation that can drift.
 */

import {
  layersForScene,
  resolveLayerColors,
  resolveTransform,
  type Breakpoint,
  type Layer,
  type LayoutDoc,
  type SceneId,
  type Transform,
  type TransformOverride,
  type VariantPalette,
} from "@/lib/themes/builder/types";

export interface ResolvedLayer {
  layer: Layer;
  transform: Transform;
}

/**
 * What one variant changes about one layer.
 *
 * The transform keys sit at the top level for backwards compatibility — that
 * is the shape the legacy importer has always written — and `paint` carries
 * the variant's own colours.
 *
 * Colours live here rather than in the layout document because the document is
 * shared by every colour of a design: an admin who recoloured the seal on the
 * navy variant was recolouring it on all of them. `paint` is shaped like the
 * layer itself (`{ style: { color }, borderColor, ... }`) and deep-merged over
 * it, so each colour genuinely gets its own colours.
 */
export interface LayerOverride extends TransformOverride {
  paint?: Record<string, unknown>;
}

/** Sparse per-variant tweaks, keyed by layer id. Usually absent. */
export type LayoutOverrides = Record<string, LayerOverride | undefined>;

/** Deep-merges a sparse patch over a layer, cloning only the touched path. */
function applyPaint<T>(layer: T, paint: Record<string, unknown>): T {
  const out = { ...(layer as Record<string, unknown>) };
  for (const [key, value] of Object.entries(paint)) {
    if (value === undefined) continue;
    const current = out[key];
    if (value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object" && !Array.isArray(current)) {
      out[key] = applyPaint(current as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function parseLayoutOverrides(raw: unknown): LayoutOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as LayoutOverrides;
}

/**
 * @param palette The colour being rendered. Every `@role` colour on a layer —
 *   in the shared document or in this variant's own `paint` — resolves against
 *   it here, so the layer renderers only ever see hex. Omitted only by callers
 *   that never paint (geometry-only work); a role then reaches the renderer
 *   as-is and `textStyleToCss` lets it inherit the stage colour.
 */
export function resolveScene(
  doc: LayoutDoc,
  scene: SceneId,
  breakpoint: Breakpoint,
  overrides: LayoutOverrides = {},
  palette?: VariantPalette,
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
      if (!variantOverride) return { layer: paletted(layer, palette), transform };

      // `paint` is not a transform key; strip it before merging geometry.
      const { paint, ...geometry } = variantOverride;
      return {
        // Paint first, then resolve: a variant's own `@fgMuted` on a layer the
        // design keeps at `@fg` must win before either becomes a hex.
        layer: paletted(paint ? applyPaint(layer, paint) : layer, palette),
        transform: { ...transform, ...stripUndefined(geometry) },
      };
    });
}

function paletted(layer: Layer, palette: VariantPalette | undefined): Layer {
  return palette ? resolveLayerColors(layer, palette) : layer;
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
