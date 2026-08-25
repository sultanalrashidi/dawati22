/**
 * Theme Builder document model.
 *
 * A builder theme keeps **zero** design decisions in code. Everything an admin
 * arranges in the visual editor — which image sits where, how big, how rotated,
 * which text box holds the guest name, where the QR lands — is stored in two
 * JSON documents in Postgres (`ThemeLayout.doc`, `ThemeTypography.doc`) and
 * replayed by one generic renderer.
 *
 * Coordinate system: every layer is positioned against its scene's *stage*, a
 * box with a fixed aspect ratio that scales to whatever the device gives it.
 * Positions/sizes are percentages of that stage, so a layout authored once is
 * correct on a 375px iPhone and a 1440px desktop alike. `base` holds the
 * mobile-first values; `tablet`/`desktop` are sparse overrides applied on top.
 */

/** Bumped when a migration of stored documents is required. */
export const BUILDER_SCHEMA_VERSION = 1;

/** The three screens a builder theme controls. */
export const SCENE_IDS = ["cover", "open", "pass"] as const;
export type SceneId = (typeof SCENE_IDS)[number];

/** Editor breakpoints. `base` is mobile-first and is always complete. */
export const BREAKPOINTS = ["base", "tablet", "desktop"] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/** Min viewport width each breakpoint takes over at. */
export const BREAKPOINT_MIN_WIDTH: Record<Breakpoint, number> = {
  base: 0,
  tablet: 768,
  desktop: 1024,
};

/** Device frame sizes the editor previews in. */
export const DEVICE_PRESETS: Record<Breakpoint, { label: string; labelAr: string; width: number; height: number }> = {
  base: { label: "Mobile", labelAr: "جوال", width: 390, height: 844 },
  tablet: { label: "Tablet", labelAr: "تابلت", width: 768, height: 1024 },
  desktop: { label: "Desktop", labelAr: "كمبيوتر", width: 1280, height: 800 },
};

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

export interface Transform {
  /** Center X, as % of stage width. */
  x: number;
  /** Center Y, as % of stage height. */
  y: number;
  /** Width, as % of stage width. */
  width: number;
  /** Height as % of stage height, or `null` to keep the image's own ratio. */
  height: number | null;
  /** Multiplier applied on top of width/height. */
  scale: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** 0..1 */
  opacity: number;
}

export type TransformOverride = Partial<Transform>;

export const DEFAULT_TRANSFORM: Transform = {
  x: 50,
  y: 50,
  width: 80,
  height: null,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/**
 * A font is either a literal family name ("Amiri") or a reference to one of the
 * theme's named roles, written `@display`. Roles let one change re-style every
 * layer that points at it — which is what makes "the invitation-text font" a
 * single setting rather than a per-layer chore.
 */
export type FontRef = string;

export const FONT_ROLE_PREFIX = "@";

export interface TextStyle {
  font: FontRef;
  /**
   * Font size in px measured against a 390px-wide stage; the renderer scales it
   * with the stage so type keeps its proportion on every screen.
   */
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "start" | "center" | "end";
  lineHeight: number;
  /** em */
  letterSpacing: number;
}

export type TextStyleOverride = Partial<TextStyle>;

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font: "@body",
  fontSize: 16,
  fontWeight: 400,
  color: "#000000",
  align: "center",
  lineHeight: 1.6,
  letterSpacing: 0,
};

/** Named font roles a theme exposes. The first three always exist. */
export interface FontRole {
  family: string;
  weight: number;
}

export interface TypographyDoc {
  version: number;
  roles: Record<string, FontRole>;
}

export const BUILT_IN_FONT_ROLES = ["display", "body", "latin"] as const;

export const DEFAULT_TYPOGRAPHY_DOC: TypographyDoc = {
  version: BUILDER_SCHEMA_VERSION,
  roles: {
    display: { family: "Amiri", weight: 400 },
    body: { family: "IBM Plex Sans Arabic", weight: 400 },
    latin: { family: "Cormorant Garamond", weight: 500 },
  },
};

// ---------------------------------------------------------------------------
// Dynamic content
// ---------------------------------------------------------------------------

/**
 * Invitation data a text layer can print. The design never bakes these into an
 * image — the renderer substitutes the real event/guest values per invitation.
 */
export const CONTENT_FIELDS = [
  "guestName",
  "groomName",
  "brideName",
  "coupleNames",
  "groomFirstName",
  "brideFirstName",
  "groomNameEn",
  "brideNameEn",
  "hostName",
  "eventDate",
  "eventDateShort",
  "eventTime",
  "locationName",
  "locationFull",
  "regionName",
  "invitationText",
  "greeting",
] as const;
export type ContentField = (typeof CONTENT_FIELDS)[number];

export const CONTENT_FIELD_LABELS_AR: Record<ContentField, string> = {
  guestName: "اسم المدعو",
  groomName: "اسم العريس",
  brideName: "اسم العروس",
  coupleNames: "اسما العروسين",
  groomFirstName: "اسم العريس (بدون العائلة)",
  brideFirstName: "اسم العروس (بدون العائلة)",
  groomNameEn: "اسم العريس (إنجليزي)",
  brideNameEn: "اسم العروس (إنجليزي)",
  hostName: "اسم الداعي",
  eventDate: "التاريخ",
  eventDateShort: "التاريخ (مختصر)",
  eventTime: "الوقت",
  locationName: "الموقع",
  locationFull: "الموقع والمدينة",
  regionName: "المدينة",
  invitationText: "نص الدعوة",
  greeting: "ترحيب العائلات",
};

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export const LAYER_TYPES = ["asset", "text", "seal", "qr"] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

interface LayerCommon {
  id: string;
  /** Shown in the Layers panel. */
  name: string;
  scene: SceneId;
  /** Paint order within the scene; higher paints on top. */
  z: number;
  visible: boolean;
  locked: boolean;
  base: Transform;
  tablet?: TransformOverride;
  desktop?: TransformOverride;
}

/** An uploaded image, resolved per color variant through its slot key. */
export interface AssetLayer extends LayerCommon {
  type: "asset";
  slot: string;
  /** object-fit for the image inside its box. */
  fit: "contain" | "cover";
}

/** A text box — either fixed copy (a blessing) or invitation data. */
export interface TextLayer extends LayerCommon {
  type: "text";
  source: "static" | "content";
  /** Copy for `source: "static"`. Supports `{field}` placeholders. */
  text: string;
  /** Ordered invitation fields for `source: "content"`, one per line. */
  fields: ContentField[];
  style: TextStyle;
  tabletStyle?: TextStyleOverride;
  desktopStyle?: TextStyleOverride;
}

/** The couple's initials, printed live over the seal art rather than baked in. */
export interface SealLayer extends LayerCommon {
  type: "seal";
  mode: "initials" | "static";
  /**
   * Which names the initials come from. Latin is the default because a
   * monogram is nearly always set in a Latin display face — an Arabic initial
   * in Cormorant would render as a fallback glyph.
   */
  script: "latin" | "arabic";
  /**
   * Which initial leads. The hand-coded designs print the BRIDE first, so an
   * imported theme has to be able to say so rather than silently reversing the
   * monogram of every converted design.
   */
  order: "groom-first" | "bride-first";
  /** Copy for `mode: "static"`. */
  text: string;
  /** Placed between the two initials. */
  separator: string;
  maxChars: number;
  style: TextStyle;
  tabletStyle?: TextStyleOverride;
  desktopStyle?: TextStyleOverride;
}

/** The guest's entry QR. A sample code stands in while designing. */
export interface QrLayer extends LayerCommon {
  type: "qr";
  /** Quiet zone, as % of the layer's own width. */
  padding: number;
  /** px */
  borderRadius: number;
  background: string;
  borderColor: string;
  /** px */
  borderWidth: number;
  /** Module color. */
  fgColor: string;
}

export type Layer = AssetLayer | TextLayer | SealLayer | QrLayer;

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

export const ENVELOPE_ENTRANCES = ["none", "fade", "slide", "scale"] as const;
export type EnvelopeEntrance = (typeof ENVELOPE_ENTRANCES)[number];

export const ENVELOPE_OPENINGS = ["normal", "slow", "elegant"] as const;
export type EnvelopeOpening = (typeof ENVELOPE_OPENINGS)[number];

export const CARD_ENTRANCES = ["fade", "slide-up", "scale"] as const;
export type CardEntrance = (typeof CARD_ENTRANCES)[number];

export interface AnimationSettings {
  envelopeEntrance: EnvelopeEntrance;
  envelopeOpening: EnvelopeOpening;
  cardEntrance: CardEntrance;
  /** ms */
  duration: number;
  /** ms */
  delay: number;
}

export const DEFAULT_ANIMATION: AnimationSettings = {
  envelopeEntrance: "fade",
  envelopeOpening: "normal",
  cardEntrance: "fade",
  duration: 600,
  delay: 0,
};

// ---------------------------------------------------------------------------
// Scenes & the layout document
// ---------------------------------------------------------------------------

export interface SceneCanvas {
  /** Stage aspect ratio — the coordinate space layers are positioned in. */
  aspectW: number;
  aspectH: number;
  /** Safe-area inset as % of the stage. Editor guide only; never rendered. */
  safeInset: number;
}

/**
 * The full-page backdrop.
 *
 * Deliberately NOT a layer: a layer lives inside one scene's fixed-aspect
 * stage, so as a layer the background would appear on the cover and vanish on
 * every scene after it, cropped to the stage box. The page background is fixed
 * and full-bleed behind the entire invitation, on every scene.
 */
export interface PageBackground {
  /** Asset slot to use, or null for the palette's flat colour. */
  slot: string | null;
  fit: "cover" | "contain";
  /** Tint laid over the image — for holding text legible on busy art. */
  overlayColor: string;
  /** 0..1 */
  overlayOpacity: number;
}

export const DEFAULT_PAGE_BACKGROUND: PageBackground = {
  slot: "background",
  fit: "cover",
  overlayColor: "#000000",
  overlayOpacity: 0,
};

export interface LayoutDoc {
  version: number;
  page: PageBackground;
  scenes: Record<SceneId, SceneCanvas>;
  layers: Layer[];
  animation: AnimationSettings;
}

export const DEFAULT_SCENES: Record<SceneId, SceneCanvas> = {
  cover: { aspectW: 390, aspectH: 620, safeInset: 6 },
  open: { aspectW: 390, aspectH: 620, safeInset: 6 },
  pass: { aspectW: 390, aspectH: 620, safeInset: 6 },
};

export const DEFAULT_LAYOUT_DOC: LayoutDoc = {
  version: BUILDER_SCHEMA_VERSION,
  page: DEFAULT_PAGE_BACKGROUND,
  scenes: DEFAULT_SCENES,
  layers: [],
  animation: DEFAULT_ANIMATION,
};

// ---------------------------------------------------------------------------
// Variant palette
// ---------------------------------------------------------------------------

export interface VariantPalette {
  bg: string;
  surface: string;
  fg: string;
  fgMuted: string;
  accent: string;
  accentFg: string;
  /** Gallery swatch dot, when `accent` no longer reads as the variant's color. */
  swatch?: string;
}

export const DEFAULT_PALETTE: VariantPalette = {
  bg: "#F7F2EA",
  surface: "#FCF8F0",
  fg: "#4A3B2A",
  fgMuted: "#8A7860",
  accent: "#B08D57",
  accentFg: "#FFFFFF",
};

// ---------------------------------------------------------------------------
// Resolution helpers (pure — safe on both server and client)
// ---------------------------------------------------------------------------

/** Which breakpoint a viewport width falls into. */
export function breakpointForWidth(width: number): Breakpoint {
  if (width >= BREAKPOINT_MIN_WIDTH.desktop) return "desktop";
  if (width >= BREAKPOINT_MIN_WIDTH.tablet) return "tablet";
  return "base";
}

/**
 * Collapse a layer's base transform with its overrides for `bp`. Overrides
 * cascade base → tablet → desktop, so a desktop-only tweak still inherits the
 * tablet values it didn't restate.
 */
export function resolveTransform(layer: Layer, bp: Breakpoint): Transform {
  const merged = { ...layer.base };
  if (bp === "tablet" || bp === "desktop") Object.assign(merged, stripUndefined(layer.tablet));
  if (bp === "desktop") Object.assign(merged, stripUndefined(layer.desktop));
  return merged;
}

/** Same cascade for text styling. */
export function resolveTextStyle(
  layer: TextLayer | SealLayer,
  bp: Breakpoint,
): TextStyle {
  const merged = { ...layer.style };
  if (bp === "tablet" || bp === "desktop") Object.assign(merged, stripUndefined(layer.tabletStyle));
  if (bp === "desktop") Object.assign(merged, stripUndefined(layer.desktopStyle));
  return merged;
}

/** `Object.assign` would happily copy `undefined` over a real value. */
function stripUndefined<T extends object>(source: T | undefined): Partial<T> {
  if (!source) return {};
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** Resolve a `@role` font reference against the theme's typography doc. */
export function resolveFont(ref: FontRef, typography: TypographyDoc): FontRole {
  if (ref.startsWith(FONT_ROLE_PREFIX)) {
    const roleName = ref.slice(FONT_ROLE_PREFIX.length);
    return typography.roles[roleName] ?? typography.roles.body ?? DEFAULT_TYPOGRAPHY_DOC.roles.body;
  }
  return { family: ref, weight: 400 };
}

/** Layers of one scene, in paint order. */
export function layersForScene(doc: LayoutDoc, scene: SceneId): Layer[] {
  return doc.layers.filter((l) => l.scene === scene).sort((a, b) => a.z - b.z);
}
