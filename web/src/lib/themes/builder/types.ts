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

/**
 * Bumped when a migration of stored documents is required.
 *
 * - v2: scenes became an ordered, designable list.
 * - v3: colours became palette ROLES (`@fg`, `@fgMuted`, …) instead of hex
 *   baked from whichever colour the design happened to be converted on. The
 *   upgrade needs the variants' palettes, so it runs in `ink-roles.ts` from
 *   the server loaders rather than in `parseLayoutDoc`.
 */
export const BUILDER_SCHEMA_VERSION = 3;

/**
 * A scene is one screen of the invitation. They are an ORDERED LIST, not a
 * fixed set: an admin adds, removes, renames and reorders them per design, so
 * one theme can drop the countdown while another adds two extra screens.
 *
 * `id` is a free string. The three built-in ids below are the ones the guest
 * flow gives special treatment, and older documents already use them as keys.
 */
export type SceneId = string;

export const SCENE_COVER = "cover";
export const SCENE_OPEN = "open";
export const SCENE_PASS = "pass";

/**
 * What the guest flow does with a scene.
 * - `cover`: the tap-to-open screen, shown before the invitation opens. Exactly one.
 * - `flow`:  an ordinary scroll-snapped screen in the post-open sequence.
 * - `pass`:  the entry pass, shown only after the guest accepts.
 */
export const SCENE_ROLES = ["cover", "flow", "pass"] as const;
export type SceneRole = (typeof SCENE_ROLES)[number];

/**
 * Event data a scene needs before it is worth showing. A scene requiring
 * `schedule` is skipped for an event with no schedule, exactly as the
 * hand-coded flow skips it today.
 */
export const SCENE_REQUIREMENTS = ["schedule", "notes", "map", "music"] as const;
export type SceneRequirement = (typeof SCENE_REQUIREMENTS)[number];

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

// ---------------------------------------------------------------------------
// Palette colour roles
// ---------------------------------------------------------------------------

/**
 * A colour is either a literal hex ("#5C4526") or a reference to one slot of
 * the variant's palette, written `@fg` — the same idea as `@display` for
 * fonts. A role resolves against whichever COLOUR of the design is being
 * rendered, so a text box set to `@fg` follows every variant's own "النص"
 * without anyone repainting it per colour. A literal hex is an explicit
 * override and stays exactly that colour.
 *
 * This is what makes "the primary text colour" one setting on the palette
 * rather than a per-layer, per-variant chore — the bug that motivated it was a
 * new colour whose text kept the ink of the colour it was copied from.
 */
export type ColorRef = string;

export const COLOR_ROLE_PREFIX = "@";

export const PALETTE_ROLES = ["fg", "fgMuted", "accent", "accentFg", "surface", "bg"] as const;
export type PaletteRole = (typeof PALETTE_ROLES)[number];

export const PALETTE_ROLE_LABELS_AR: Record<PaletteRole, string> = {
  fg: "النص",
  fgMuted: "نص ثانوي",
  accent: "اللون المميز",
  accentFg: "نص فوق المميز",
  surface: "السطح",
  bg: "الخلفية",
};

/** The palette slot a `@role` reference names, or null for a literal colour. */
export function colorRoleOf(ref: string): PaletteRole | null {
  if (!ref.startsWith(COLOR_ROLE_PREFIX)) return null;
  const role = ref.slice(COLOR_ROLE_PREFIX.length);
  return (PALETTE_ROLES as readonly string[]).includes(role) ? (role as PaletteRole) : null;
}

export function isColorRole(ref: string): boolean {
  return ref.startsWith(COLOR_ROLE_PREFIX);
}

export function roleRef(role: PaletteRole): ColorRef {
  return `${COLOR_ROLE_PREFIX}${role}`;
}

/**
 * A stored colour as CSS: a role becomes the variant's own value, a literal
 * passes through. An unknown role falls back to the primary text colour — the
 * one value every design can be read in.
 */
export function resolveColor(ref: ColorRef, palette: VariantPalette): string {
  if (!isColorRole(ref)) return ref;
  const role = colorRoleOf(ref);
  return role ? palette[role] : palette.fg;
}

export interface TextStyle {
  font: FontRef;
  /**
   * Font size in px measured against a 390px-wide stage; the renderer scales it
   * with the stage so type keeps its proportion on every screen.
   */
  fontSize: number;
  fontWeight: number;
  /** A hex literal or a palette role — see `ColorRef`. */
  color: ColorRef;
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
  // The palette's primary text colour, so a new text box follows each colour
  // of the design from the moment it is added.
  color: "@fg",
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
  "allowedCount",
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
  // --- Women's-section invitation wording (composed in content.ts) ---
  "opening",
  "hostLine",
  "inviteVerb",
  "coupleLine",
  "inviteLine",
  "inshallah",
  "closing",
] as const;
export type ContentField = (typeof CONTENT_FIELDS)[number];

export const CONTENT_FIELD_LABELS_AR: Record<ContentField, string> = {
  guestName: "اسم المدعو",
  allowedCount: "عدد المقاعد المسموح بها",
  groomName: "اسم العريس",
  brideName: "اسم العروس",
  coupleNames: "اسما العروسين",
  groomFirstName: "اسم العريس (بدون العائلة)",
  brideFirstName: "اسم العروس (بدون العائلة)",
  groomNameEn: "اسم العريس (إنجليزي)",
  brideNameEn: "اسم العروس (إنجليزي)",
  hostName: "اسم الداعي",
  eventDate: "التاريخ (هجري وميلادي)",
  eventDateShort: "التاريخ (مختصر، ميلادي)",
  eventTime: "الوقت",
  locationName: "الموقع",
  locationFull: "الموقع والمدينة",
  regionName: "المدينة",
  invitationText: "نص الدعوة",
  greeting: "ترحيب العائلات",
  opening: "الافتتاحية (بسملة / آية / دعاء)",
  hostLine: "سطر الداعي",
  inviteVerb: "بدعوتكم لحضور حفل زفاف",
  coupleLine: "سطر العروسين (حسب الصيغة المختارة)",
  inviteLine: "الدعوة كاملة (الداعي + العروسين)",
  inshallah: "وذلك بمشيئة الله تعالى",
  closing: "الخاتمة",
};

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export const LAYER_TYPES = [
  "asset",
  "text",
  "seal",
  "qr",
  "countdown",
  "button",
  "rsvp",
  "schedule",
  "notes",
] as const;
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
  /** Optional silhouette in percentages of the image box. */
  clipPolygon?: { x: number; y: number }[];
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

/** The live counter to the event. Numbers and their labels style separately. */
export interface CountdownLayer extends LayerCommon {
  type: "countdown";
  /** Optional heading above the digits, e.g. "يفصلنا عن المناسبة". */
  title: string;
  titleStyle: TextStyle;
  numberStyle: TextStyle;
  labelStyle: TextStyle;
  /** Frame around the digits. */
  boxColor: string;
  boxOpacity: number;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  /** Drop the seconds column for a calmer design. */
  showSeconds: boolean;
}

export const BUTTON_ACTIONS = ["calendar", "map", "music", "link"] as const;
export type ButtonAction = (typeof BUTTON_ACTIONS)[number];

/** An action the guest can take — add to calendar, open the map, a custom link. */
export interface ButtonLayer extends LayerCommon {
  type: "button";
  action: ButtonAction;
  label: string;
  /** Destination for `action: "link"`. */
  href: string;
  style: TextStyle;
  background: string;
  backgroundOpacity: number;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
}

/**
 * The real RSVP form.
 *
 * Positioned and sized as ONE block rather than field-by-field: its inputs,
 * the accept/decline buttons and the submit action are a working form, and
 * letting them be dragged apart individually is how a design ends up unable to
 * take a booking. Colours and the field font still follow the theme.
 */
export interface RsvpLayer extends LayerCommon {
  type: "rsvp";
  /** Opt-in scrolling inside the authored box; absent keeps existing layouts. */
  overflow?: "scroll";
  title: string;
  titleStyle: TextStyle;
  fieldStyle: TextStyle;
  fieldBackground: string;
  borderColor: string;
  borderRadius: number;
  /** Accent for the primary submit/accept control. */
  accent: string;
  accentFg: string;
}

/** The event-day timeline. One block; rows come from the event's own schedule. */
export interface ScheduleLayer extends LayerCommon {
  type: "schedule";
  /** Opt-in scrolling inside the authored box; absent keeps existing layouts. */
  overflow?: "scroll";
  title: string;
  titleStyle: TextStyle;
  timeStyle: TextStyle;
  labelStyle: TextStyle;
  /** Space between rows, as % of the layer's height. */
  rowGap: number;
}

/** Free-text notes the organiser set, one per line. */
export interface NotesLayer extends LayerCommon {
  type: "notes";
  /** Opt-in scrolling inside the authored box; absent keeps existing layouts. */
  overflow?: "scroll";
  title: string;
  titleStyle: TextStyle;
  itemStyle: TextStyle;
  /** Character shown before each line; empty for none. */
  bullet: string;
}

export type Layer =
  | AssetLayer
  | TextLayer
  | SealLayer
  | QrLayer
  | CountdownLayer
  | ButtonLayer
  | RsvpLayer
  | ScheduleLayer
  | NotesLayer;

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

export interface SceneDef {
  id: SceneId;
  /** Shown on the editor's scene tab. */
  name: string;
  role: SceneRole;
  canvas: SceneCanvas;
  /** Unchecking hides the scene from guests without deleting its layers. */
  visible: boolean;
  /** Skip the scene when the event carries none of this data. */
  requires: SceneRequirement | null;
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
  /** Ordered — this is the order the guest scrolls through. */
  scenes: SceneDef[];
  layers: Layer[];
  animation: AnimationSettings;
}

export const DEFAULT_CANVAS: SceneCanvas = { aspectW: 390, aspectH: 620, safeInset: 6 };

export const DEFAULT_SCENES: SceneDef[] = [
  { id: SCENE_COVER, name: "الظرف المغلق", role: "cover", canvas: DEFAULT_CANVAS, visible: true, requires: null },
  { id: SCENE_OPEN, name: "الظرف المفتوح", role: "flow", canvas: DEFAULT_CANVAS, visible: true, requires: null },
  { id: SCENE_PASS, name: "بطاقة الدخول", role: "pass", canvas: DEFAULT_CANVAS, visible: true, requires: null },
];

/** Lookup by id, for the many callers that only have a scene id in hand. */
export function findScene(doc: LayoutDoc, sceneId: SceneId): SceneDef | undefined {
  return doc.scenes.find((scene) => scene.id === sceneId);
}

export function sceneCanvas(doc: LayoutDoc, sceneId: SceneId): SceneCanvas {
  return findScene(doc, sceneId)?.canvas ?? DEFAULT_CANVAS;
}

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

/**
 * The ground every new design and every new colour starts from.
 *
 * `fgMuted` and `accentFg` are not the hues they look like they should be:
 * the obvious #8A7860 and white read at 3.82:1 and 3.09:1 on their own
 * backgrounds, so a design would open below the contrast floor the whole
 * collection was brought up to and be corrected afterwards. These are those
 * two colours walked to 4.5:1 by `readableInk`, and `collection-standard`'s
 * test re-derives them so they cannot drift back.
 */
export const DEFAULT_PALETTE: VariantPalette = {
  bg: "#F7F2EA",
  surface: "#FCF8F0",
  fg: "#4A3B2A",
  fgMuted: "#7c6c56",
  accent: "#B08D57",
  accentFg: "#2b2b2b",
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

/**
 * Every layer property that holds a colour, and every nested text style whose
 * `color` does. One list, so the renderer's role resolution, the editor's
 * variant-paint routing and the stored-document upgrade cannot disagree about
 * what a colour IS.
 */
export const TEXT_STYLE_KEYS = [
  "style",
  "tabletStyle",
  "desktopStyle",
  "titleStyle",
  "numberStyle",
  "labelStyle",
  "timeStyle",
  "itemStyle",
  "fieldStyle",
] as const;
export type TextStyleKey = (typeof TEXT_STYLE_KEYS)[number];

export const LAYER_COLOR_KEYS = [
  "background",
  "borderColor",
  "boxColor",
  "fgColor",
  "fieldBackground",
  "accent",
  "accentFg",
] as const;
export type LayerColorKey = (typeof LAYER_COLOR_KEYS)[number];

/**
 * A layer with every `@role` colour replaced by the palette's value, so the
 * layer renderers only ever see CSS-ready hex. Returns the same object when
 * nothing needed resolving — most layers, once resolved, are cheap to skip.
 */
export function resolveLayerColors<T extends Layer>(layer: T, palette: VariantPalette): T {
  const source = layer as unknown as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  const draft = () => (out ??= { ...source });

  for (const key of LAYER_COLOR_KEYS) {
    const value = source[key];
    if (typeof value === "string" && isColorRole(value)) draft()[key] = resolveColor(value, palette);
  }
  for (const key of TEXT_STYLE_KEYS) {
    const style = source[key];
    if (!style || typeof style !== "object") continue;
    const color = (style as { color?: unknown }).color;
    if (typeof color === "string" && isColorRole(color)) {
      draft()[key] = { ...(style as object), color: resolveColor(color, palette) };
    }
  }
  return (out ?? source) as unknown as T;
}

/** Layers of one scene, in paint order. */
export function layersForScene(doc: LayoutDoc, scene: SceneId): Layer[] {
  return doc.layers.filter((l) => l.scene === scene).sort((a, b) => a.z - b.z);
}
