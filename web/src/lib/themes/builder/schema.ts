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
import {
  BUILDER_SCHEMA_VERSION,
  CARD_ENTRANCES,
  CONTENT_FIELDS,
  DEFAULT_ANIMATION,
  DEFAULT_LAYOUT_DOC,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SCENES,
  DEFAULT_TYPOGRAPHY_DOC,
  ENVELOPE_ENTRANCES,
  ENVELOPE_OPENINGS,
  SCENE_IDS,
  type LayoutDoc,
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
  scene: z.enum(SCENE_IDS),
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

export const layerSchema = z.discriminatedUnion("type", [
  assetLayerSchema,
  textLayerSchema,
  sealLayerSchema,
  qrLayerSchema,
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
  scenes: z.object({
    cover: sceneCanvasSchema,
    open: sceneCanvasSchema,
    pass: sceneCanvasSchema,
  }),
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
 */
export function parseLayoutDoc(raw: unknown): LayoutDoc {
  const direct = layoutDocSchema.safeParse(raw);
  if (direct.success) return direct.data as LayoutDoc;

  const source = (raw ?? {}) as Record<string, unknown>;
  const layers = Array.isArray(source.layers)
    ? source.layers.flatMap((entry) => {
        const parsed = layerSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
    : [];

  const scenes = { ...DEFAULT_SCENES };
  const rawScenes = (source.scenes ?? {}) as Record<string, unknown>;
  for (const id of SCENE_IDS) {
    const parsed = sceneCanvasSchema.safeParse(rawScenes[id]);
    if (parsed.success) scenes[id] = parsed.data;
  }

  const animation = animationSchema.safeParse(source.animation);
  const page = pageBackgroundSchema.safeParse(source.page);

  return {
    version: BUILDER_SCHEMA_VERSION,
    page: page.success ? page.data : DEFAULT_PAGE_BACKGROUND,
    scenes,
    layers: layers as LayoutDoc["layers"],
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

export function assertPalette(raw: unknown): VariantPalette {
  const parsed = paletteSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BuilderValidationError("Invalid palette", formatIssues(parsed.error));
  }
  return parsed.data;
}

export const EMPTY_LAYOUT_DOC: LayoutDoc = DEFAULT_LAYOUT_DOC;
