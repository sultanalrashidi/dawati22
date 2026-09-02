/**
 * Runtime validation for the builder's stored documents.
 *
 * These documents are authored by a visual editor and round-trip through a
 * `Json` column, so the type annotations on the way out are a promise the
 * database cannot keep. Everything read back is parsed here before a renderer
 * touches it: a malformed layer is dropped rather than crashing a guest's
 * invitation, and out-of-range numbers are clamped instead of producing an
 * element positioned three screens off-stage.
 */

import { z } from "zod";
import { upgradeStockFlowLayers, withDefaultFlow } from "@/lib/themes/builder/default-flow";
import {
  BUILDER_SCHEMA_VERSION,
  CARD_ENTRANCES,
  CONTENT_FIELDS,
  DEFAULT_ANIMATION,
  DEFAULT_LAYOUT_DOC,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_CANVAS,
  DEFAULT_SCENES,
  DEFAULT_TYPOGRAPHY_DOC,
  BUTTON_ACTIONS,
  ENVELOPE_ENTRANCES,
  ENVELOPE_OPENINGS,
  SCENE_REQUIREMENTS,
  SCENE_ROLES,
  type LayoutDoc,
  type SceneDef,
  type SceneRole,
  type TypographyDoc,
  type VariantPalette,
} from "@/lib/themes/builder/types";

/** `#rgb`, `#rrggbb`, or `#rrggbbaa`. */
const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Expected a hex color");

const percent = z.number().finite().min(-200).max(300);
const positivePercent = z.number().finite().min(0.1).max(400);

const transformSchema = z.object({
  x: percent,
  y: percent,
  width: positivePercent,
  height: positivePercent.nullable(),
  scale: z.number().finite().min(0.05).max(10),
  rotation: z.number().finite().min(-360).max(360),
  opacity: z.number().finite().min(0).max(1),
});

const transformOverrideSchema = transformSchema.partial();

const textStyleSchema = z.object({
  font: z.string().min(1).max(80),
  fontSize: z.number().finite().min(4).max(200),
  fontWeight: z.number().int().min(100).max(900),
  color: hexColor,
  align: z.enum(["start", "center", "end"]),
  lineHeight: z.number().finite().min(0.5).max(4),
  letterSpacing: z.number().finite().min(-0.5).max(2),
});

const textStyleOverrideSchema = textStyleSchema.partial();

const layerCommon = {
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  // A free string now that scenes are user-defined; the renderer simply finds
  // no scene for an id that no longer exists and skips the layer.
  scene: z.string().min(1).max(64),
  z: z.number().int().min(0).max(999),
  visible: z.boolean(),
  locked: z.boolean(),
  base: transformSchema,
  tablet: transformOverrideSchema.optional(),
  desktop: transformOverrideSchema.optional(),
};

const assetLayerSchema = z.object({
  ...layerCommon,
  type: z.literal("asset"),
  slot: z.string().min(1).max(40),
  fit: z.enum(["contain", "cover"]),
});

const textLayerSchema = z.object({
  ...layerCommon,
  type: z.literal("text"),
  source: z.enum(["static", "content"]),
  text: z.string().max(2000),
  fields: z.array(z.enum(CONTENT_FIELDS)).max(12),
  style: textStyleSchema,
  tabletStyle: textStyleOverrideSchema.optional(),
  desktopStyle: textStyleOverrideSchema.optional(),
});

const sealLayerSchema = z.object({
  ...layerCommon,
  type: z.literal("seal"),
  mode: z.enum(["initials", "static"]),
  script: z.enum(["latin", "arabic"]).default("latin"),
  order: z.enum(["groom-first", "bride-first"]).default("groom-first"),
  text: z.string().max(40),
  separator: z.string().max(5),
  maxChars: z.number().int().min(1).max(10),
  style: textStyleSchema,
  tabletStyle: textStyleOverrideSchema.optional(),
  desktopStyle: textStyleOverrideSchema.optional(),
});

const qrLayerSchema = z.object({
  ...layerCommon,
  type: z.literal("qr"),
  padding: z.number().finite().min(0).max(40),
  borderRadius: z.number().finite().min(0).max(200),
  background: hexColor,
  borderColor: hexColor,
  borderWidth: z.number().finite().min(0).max(40),
  fgColor: hexColor,
});

const countdownLayerSchema = z.object({
  ...layerCommon,
  type: z.literal("countdown"),
  title: z.string().max(120),
  titleStyle: textStyleSchema,
  numberStyle: textStyleSchema,
  labelStyle: textStyleSchema,
  boxColor: hexColor,
  boxOpacity: z.number().finite().min(0).max(1),
  borderColor: hexColor,
  borderWidth: z.number().finite().min(0).max(20),
  borderRadius: z.number().finite().min(0).max(200),
  showSeconds: z.boolean(),
});

const buttonLayerSchema = z.object({
  ...layerCommon,
  type: z.literal("button"),
  action: z.enum(BUTTON_ACTIONS),
  label: z.string().max(80),
  href: z.string().max(500),
  style: textStyleSchema,
  background: hexColor,
  backgroundOpacity: z.number().finite().min(0).max(1),
  borderColor: hexColor,
  borderWidth: z.number().finite().min(0).max(20),
  borderRadius: z.number().finite().min(0).max(200),
});

const rsvpLayerSchema = z.object({
  ...layerCommon,
  type: z.literal("rsvp"),
  title: z.string().max(120),
  titleStyle: textStyleSchema,
  fieldStyle: textStyleSchema,
  fieldBackground: hexColor,
  borderColor: hexColor,
  borderRadius: z.number().finite().min(0).max(200),
  accent: hexColor,
  accentFg: hexColor,
});

const scheduleLayerSchema = z.object({
  ...layerCommon,
  type: z.literal("schedule"),
  title: z.string().max(120),
  titleStyle: textStyleSchema,
  timeStyle: textStyleSchema,
  labelStyle: textStyleSchema,
  rowGap: z.number().finite().min(0).max(50),
});

const notesLayerSchema = z.object({
  ...layerCommon,
  type: z.literal("notes"),
  title: z.string().max(120),
  titleStyle: textStyleSchema,
  itemStyle: textStyleSchema,
  bullet: z.string().max(4),
});

export const layerSchema = z.discriminatedUnion("type", [
  assetLayerSchema,
  textLayerSchema,
  sealLayerSchema,
  qrLayerSchema,
  countdownLayerSchema,
  buttonLayerSchema,
  rsvpLayerSchema,
  scheduleLayerSchema,
  notesLayerSchema,
]);

const pageBackgroundSchema = z.object({
  slot: z.string().min(1).max(40).nullable(),
  fit: z.enum(["cover", "contain"]),
  overlayColor: hexColor,
  overlayOpacity: z.number().finite().min(0).max(1),
});

const sceneCanvasSchema = z.object({
  aspectW: z.number().finite().min(1).max(10000),
  aspectH: z.number().finite().min(1).max(10000),
  safeInset: z.number().finite().min(0).max(40),
});

const sceneDefSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  role: z.enum(SCENE_ROLES),
  canvas: sceneCanvasSchema,
  visible: z.boolean(),
  requires: z.enum(SCENE_REQUIREMENTS).nullable(),
});

const animationSchema = z.object({
  envelopeEntrance: z.enum(ENVELOPE_ENTRANCES),
  envelopeOpening: z.enum(ENVELOPE_OPENINGS),
  cardEntrance: z.enum(CARD_ENTRANCES),
  duration: z.number().finite().min(0).max(5000),
  delay: z.number().finite().min(0).max(5000),
});

export const layoutDocSchema = z.object({
  version: z.number().int().min(1),
  // Defaulted, not required: documents written before the page background
  // existed must keep parsing rather than falling into the salvage path.
  page: pageBackgroundSchema.default(DEFAULT_PAGE_BACKGROUND),
  scenes: z.array(sceneDefSchema).min(1).max(30),
  layers: z.array(layerSchema).max(120),
  animation: animationSchema,
});

export const fontRoleSchema = z.object({
  family: z.string().min(1).max(80),
  weight: z.number().int().min(100).max(900),
});

export const typographyDocSchema = z.object({
  version: z.number().int().min(1),
  roles: z.record(z.string().min(1).max(40), fontRoleSchema),
});

export const paletteSchema = z.object({
  bg: hexColor,
  surface: hexColor,
  fg: hexColor,
  fgMuted: hexColor,
  accent: hexColor,
  accentFg: hexColor,
  swatch: hexColor.optional(),
});

// ---------------------------------------------------------------------------
// Lenient read paths
// ---------------------------------------------------------------------------

/**
 * Parse a stored layout document, salvaging as much as possible.
 *
 * A guest's invitation must never 500 because one layer in a 30-layer theme
 * carries a stale field. Whole-document parse first; if that fails, keep every
 * layer that validates on its own and fall back to defaults for the rest.
 *
 * Every path that yields a document — the valid v2, the salvaged array, the
 * grafted v1 — runs the stock greeting upgrade last, so the guest page and the
 * editor (which share this parser) both see the redesigned wording and the
 * editor persists it on the next save.
 */
/**
 * Upgrade a v1 document's fixed `{cover, open, pass}` scene object into the v2
 * ordered list. Returns null when the input isn't that old shape.
 *
 * The three ids are preserved exactly, because every stored layer already
 * points at them through `layer.scene` — renaming them here would orphan every
 * layer in every existing theme.
 */
/**
 * Make a scene list coherent instead of rejecting it.
 *
 * Duplicate ids and a second `cover` are both survivable: the renderer picks
 * the first match and everything else on the losing scene becomes unreachable,
 * which reads to an admin as "my layers vanished". Self-healing on read keeps a
 * damaged document usable and lets the editor's own guards do the real work.
 */
function normalizeScenes(scenes: SceneDef[]): SceneDef[] {
  const seen = new Set<string>();
  let haveCover = false;
  let havePass = false;
  const out: SceneDef[] = [];

  for (const scene of scenes) {
    if (seen.has(scene.id)) continue;
    seen.add(scene.id);

    let role = scene.role;
    if (role === "cover") {
      if (haveCover) role = "flow";
      else haveCover = true;
    } else if (role === "pass") {
      if (havePass) role = "flow";
      else havePass = true;
    }
    out.push(role === scene.role ? scene : { ...scene, role });
  }

  // A list with no cover leaves the guest no screen to tap; promote the first.
  if (!haveCover && out.length > 0) out[0] = { ...out[0], role: "cover", visible: true };
  if (out.length === 0) return DEFAULT_SCENES;

  // The cover opens the invitation and the pass closes it, so they are fixed
  // points of the order rather than entries in it. The guest renderer already
  // picks them out by role, but the editor numbers the list — a document saved
  // with the cover in the middle would show the admin a screen order that does
  // not match what the guest scrolls through. Pinning them here means every
  // reader agrees, including documents saved before this rule existed.
  const cover = out.filter((scene) => scene.role === "cover");
  const pass = out.filter((scene) => scene.role === "pass");
  const flow = out.filter((scene) => scene.role === "flow");
  return [...cover, ...flow, ...pass];
}

function upgradeLegacyScenes(raw: unknown): SceneDef[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const roles: Record<string, SceneRole> = { cover: "cover", open: "flow", pass: "pass" };
  const names: Record<string, string> = {
    cover: "الظرف المغلق",
    open: "الظرف المفتوح",
    pass: "بطاقة الدخول",
  };

  const scenes: SceneDef[] = [];
  for (const id of ["cover", "open", "pass"]) {
    const canvas = sceneCanvasSchema.safeParse(source[id]);
    scenes.push({
      id,
      name: names[id],
      role: roles[id],
      canvas: canvas.success ? canvas.data : DEFAULT_CANVAS,
      visible: true,
      requires: null,
    });
  }
  return scenes;
}

export function parseLayoutDoc(raw: unknown): LayoutDoc {
  const direct = layoutDocSchema.safeParse(raw);
  if (direct.success) {
    // Structurally valid is not the same as coherent: the schema happily
    // accepts two scenes sharing an id, three covers, or a list with none.
    // Normalize on the way out so the renderer and the editor can both assume
    // exactly one cover, at most one pass, and unique ids.
    const doc = direct.data as LayoutDoc;
    const scenes = normalizeScenes(doc.scenes);
    return { ...doc, scenes, layers: upgradeStockFlowLayers(scenes, doc.layers) };
  }

  const source = (raw ?? {}) as Record<string, unknown>;
  const layers = Array.isArray(source.layers)
    ? source.layers.flatMap((entry) => {
        const parsed = layerSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
    : [];

  // v2 array first, then the v1 object, then the defaults. Rescue the array
  // ENTRY BY ENTRY, exactly as layers are rescued above: one malformed scene
  // must not discard an admin's whole scene list and orphan every layer on a
  // custom scene id.
  const rawScenes = source.scenes;
  let scenes: SceneDef[];
  let grafted = layers as LayoutDoc["layers"];

  if (Array.isArray(rawScenes)) {
    const salvaged = rawScenes.flatMap((entry) => {
      const parsed = sceneDefSchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    });
    scenes = normalizeScenes(salvaged.length > 0 ? salvaged : DEFAULT_SCENES);
  } else {
    const upgraded = upgradeLegacyScenes(rawScenes);
    if (upgraded) {
      // A v1 document named only cover/open/pass because the rest of the flow
      // was hardcoded. Now that the scene list IS the flow, graft the default
      // screens on or the invitation silently loses five of them.
      const merged = withDefaultFlow(upgraded, grafted);
      scenes = normalizeScenes(merged.scenes);
      grafted = merged.layers as LayoutDoc["layers"];
    } else {
      scenes = DEFAULT_SCENES;
    }
  }

  const animation = animationSchema.safeParse(source.animation);
  const page = pageBackgroundSchema.safeParse(source.page);

  return {
    version: BUILDER_SCHEMA_VERSION,
    page: page.success ? page.data : DEFAULT_PAGE_BACKGROUND,
    scenes,
    layers: upgradeStockFlowLayers(scenes, grafted),
    animation: animation.success ? animation.data : DEFAULT_ANIMATION,
  };
}

export function parseTypographyDoc(raw: unknown): TypographyDoc {
  const parsed = typographyDocSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_TYPOGRAPHY_DOC;
  // The three built-in roles must always resolve, whatever the stored doc says.
  return {
    version: parsed.data.version,
    roles: { ...DEFAULT_TYPOGRAPHY_DOC.roles, ...parsed.data.roles },
  };
}

export function parsePalette(raw: unknown): VariantPalette {
  const parsed = paletteSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return { bg: "#F7F2EA", surface: "#FCF8F0", fg: "#4A3B2A", fgMuted: "#8A7860", accent: "#B08D57", accentFg: "#FFFFFF" };
}

// ---------------------------------------------------------------------------
// Strict write paths
// ---------------------------------------------------------------------------

export class BuilderValidationError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[]) {
    super(message);
    this.issues = issues;
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

/** Reject rather than salvage — an editor save must not silently lose layers. */
export function assertLayoutDoc(raw: unknown): LayoutDoc {
  const parsed = layoutDocSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BuilderValidationError("Invalid layout document", formatIssues(parsed.error));
  }
  return parsed.data as LayoutDoc;
}

export function assertTypographyDoc(raw: unknown): TypographyDoc {
  const parsed = typographyDocSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BuilderValidationError("Invalid typography document", formatIssues(parsed.error));
  }
  return parsed.data;
}

/**
 * One variant's own tweaks: geometry overrides (which the legacy importer has
 * always written) plus `paint`, the colours that belong to this colour of the
 * design rather than to the design every colour shares.
 *
 * `paint` is validated as colour-valued leaves only — it is deep-merged onto a
 * layer at render time, so letting arbitrary values through would let a saved
 * variant rewrite a layer's text, geometry or type.
 */
const paintValueSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.record(z.string().max(40), z.union([hexColor, paintValueSchema])),
);

const layerOverrideSchema = transformOverrideSchema.extend({
  paint: paintValueSchema.optional(),
});

const layoutOverridesSchema = z.record(z.string().min(1).max(80), layerOverrideSchema);

export function assertLayoutOverrides(raw: unknown): Record<string, unknown> {
  const parsed = layoutOverridesSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new BuilderValidationError("Invalid variant overrides", formatIssues(parsed.error));
  }
  return parsed.data;
}

export function assertPalette(raw: unknown): VariantPalette {
  const parsed = paletteSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BuilderValidationError("Invalid palette", formatIssues(parsed.error));
  }
  return parsed.data;
}

export const EMPTY_LAYOUT_DOC: LayoutDoc = DEFAULT_LAYOUT_DOC;
