/**
 * Measurements and colour helpers shared by every layer renderer.
 *
 * They live here rather than in `theme-stage.tsx` so a layer component can
 * reach them without importing the stage that imports the layer back — a cycle
 * that survives in dev and bites at build time.
 *
 * The whole coordinate system is one idea: a stage declares
 * `container-type: inline-size`, so `1cqw` is 1% of the stage's width. Every
 * length a designer authored in px was authored against a 390px-wide stage, so
 * dividing by that reference and expressing the result in `cqw` makes a layout
 * authored once proportionally identical at any width — no media queries.
 */

import type { CSSProperties } from "react";
import { fontStackFor } from "@/lib/themes/font-registry";
import {
  isColorRole,
  resolveFont,
  type SceneCanvas,
  type TextStyle,
  type Transform,
  type TypographyDoc,
} from "@/lib/themes/builder/types";

/** Text and box sizes in the document are authored against a stage this wide. */
export const REFERENCE_STAGE_WIDTH = 390;

/** px at the reference width → cqw, so it scales with the stage. */
export function scaled(px: number): string {
  return `${(px / REFERENCE_STAGE_WIDTH) * 100}cqw`;
}

export function textStyleToCss(style: TextStyle, typography: TypographyDoc): CSSProperties {
  const role = resolveFont(style.font, typography);
  return {
    fontFamily: fontStackFor(role.family),
    fontSize: scaled(style.fontSize),
    fontWeight: style.fontWeight,
    // `resolveScene` has already turned roles into the variant's hex. A role
    // that still reaches here came from a palette-less caller; inheriting the
    // stage's `color: palette.fg` is the right reading of "@fg" there and a
    // readable one for the rest.
    color: typeof style.color === "string" && isColorRole(style.color) ? "inherit" : style.color,
    textAlign: style.align,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacing}em`,
  };
}

/** A text style's alignment as the flex value that stacks its lines the same way. */
export function justifyFor(align: TextStyle["align"]): "flex-start" | "center" | "flex-end" {
  if (align === "start") return "flex-start";
  if (align === "end") return "flex-end";
  return "center";
}

/**
 * A layer's own height, expressed in the stage-relative `cqw` everything else
 * uses.
 *
 * `transform.height` is a percentage of the stage's *height* while `cqw` is a
 * share of its *width*, so the canvas aspect is the bridge between them. A
 * layer left at `height: null` takes its height from its content and has no
 * percentage to convert — callers pass the px height that content will occupy.
 */
export function layerHeightCqw(transform: Transform, canvas: SceneCanvas, fallbackPx: number): number {
  if (transform.height === null) return (fallbackPx / REFERENCE_STAGE_WIDTH) * 100;
  return transform.height * (canvas.aspectH / canvas.aspectW);
}

/**
 * A stored `#rgb` / `#rrggbb` / `#rrggbbaa` fill at a given opacity.
 *
 * Fading the element itself with `opacity` would take the text inside down with
 * it — a countdown's frame is meant to sit behind digits that stay solid — so
 * the alpha goes on the colour instead.
 */
export function withOpacity(hex: string, opacity: number): string {
  const clamped = Math.min(1, Math.max(0, opacity));
  const raw = hex.trim().replace("#", "");
  const expand = (part: string) => Number.parseInt(part.length === 1 ? part + part : part, 16);

  let channels: number[];
  let alpha = 1;
  if (raw.length === 3) {
    channels = [expand(raw[0]), expand(raw[1]), expand(raw[2])];
  } else if (raw.length === 6 || raw.length === 8) {
    channels = [expand(raw.slice(0, 2)), expand(raw.slice(2, 4)), expand(raw.slice(4, 6))];
    if (raw.length === 8) alpha = expand(raw.slice(6, 8)) / 255;
  } else {
    return hex;
  }

  if (channels.some((value) => Number.isNaN(value))) return hex;
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${Number((alpha * clamped).toFixed(3))})`;
}

/** `border` shorthand, or `undefined` for a zero-width border so nothing paints. */
export function borderCss(width: number, color: string): string | undefined {
  return width > 0 ? `${scaled(width)} solid ${color}` : undefined;
}
