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
    /**
     * Color swatch fill for the gallery's color picker — defaults to `accent`.
     * Set this when `accent` had to be tuned for legibility against the art
     * itself (e.g. gold monogram text on a navy wax seal) and no longer
     * matches the variant's own color name, so the swatch dot still shows
     * the true distinguishing hue (navy/burgundy/mocha, not gold-on-gold).
     */
    swatch?: string;
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
  /** Optional slow-rising decorative heart particles, tinted with this theme's own accent. */
  particles?: {
    effect: "floating-hearts";
  };
  /**
   * Bespoke closed-card design for the guest page's opening screen, rolled
   * out theme by theme. Omitted = the theme keeps its original cover UI
   * (arch/envelope/split/plain, per `layout`/`motion`) untouched.
   */
  card?: {
    style: "rose-emboss" | "bridal-frame";
    /** Public asset subfolder under /themes/ holding this variant's recolored art. Defaults to "rose-candlelight". */
    assetFolder?: string;
    /**
     * Per-variant art doesn't always share the base variant's exact photo
     * proportions or hotspot positions (a customer can supply an entirely
     * bespoke image per color, not just a recolor) — these override the
     * bridal-frame style's built-in defaults. All fields optional; omitted
     * ones fall back to the base ivory-bloom art's measurements.
     */
    layout?: {
      /** aspect-[W/H] for the closed envelope card, e.g. "1200/800". */
      closedAspect?: string;
      /** Couple-initials monogram position on the closed card, as percentages. */
      sealPosition?: { left: string; top: string };
      /** Monogram font size (any CSS length/clamp()), for medallions too small for the default. */
      sealFontSize?: string;
      /** Guest-name text box on the opened "page 1" card art. */
      openTextZone?: { insetX: string; top: string; bottom: string };
      /** Overlay positions on the RSVP-accepted pass-card art. */
      pass?: {
        textTop: string;
        iconsTop: string;
        qr: { left: string; width: string; top: string; height: string };
      };
    };
  };
  /**
   * Groups color variants of one design together in the gallery — every
   * variant of the same design shares this value (conventionally the base
   * variant's own slug). Omitted = the theme is its own standalone card.
   */
  family?: string;
  /** Arabic color-family label used by the gallery's color filter, e.g. "كحلي". */
  colorTag?: string;
}

export const THEME_ASSET_KINDS = ["COVER", "BACKGROUND", "DECORATION", "LOGO", "PATTERN"] as const;
export type ThemeAssetKind = (typeof THEME_ASSET_KINDS)[number];
