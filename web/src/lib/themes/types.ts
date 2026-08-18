/**
 * Data-driven invitation theme config. One renderer (the guest experience,
 * task 8) reads this shape and renders accordingly — adding a theme means
 * adding a row + assets, never a new page/component.
 */
export interface ThemeConfig {
  layout: "classic-center" | "arch-frame" | "envelope-reveal" | "split-portrait";
  palette: {
    bg: string;
    surface: string;
    fg: string;
    fgMuted: string;
    accent: string;
    accentFg: string;
  };
  fonts: {
    arabicDisplay: string;
    arabicBody: string;
    latinDisplay: string;
  };
  motion: {
    openStyle: "fade" | "envelope" | "curtain" | "gate-swing" | "seal-break" | "arch-reveal" | "doors";
    reducedMotionFallback: "fade";
  };
  sections: {
    showCountdown: boolean;
    showMap: boolean;
    showRsvp: boolean;
  };
  /** Optional animated canvas layer behind the card. Omitted for the flat-color background used by every other theme. */
  background?: {
    effect: "shader-silk";
  };
}

export const THEME_ASSET_KINDS = ["COVER", "BACKGROUND", "DECORATION", "LOGO", "PATTERN"] as const;
export type ThemeAssetKind = (typeof THEME_ASSET_KINDS)[number];
