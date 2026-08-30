import { DEFAULT_TYPOGRAPHY_DOC, type TypographyDoc } from "@/lib/themes/builder/types";

/**
 * The house typeface: one set of three font roles that every design can be set
 * to at once.
 *
 * Both theme engines already describe their fonts as the SAME three slots —
 * headings, body, and the Latin face — so the preset is not a new concept, just
 * the one place they were missing. A hand-coded design stores them in
 * `config.fonts`; a builder design stores them in its typography document's
 * roles. `legacy-import.ts` maps one onto the other, which is the clearest
 * evidence they mean the same thing.
 *
 * COLOUR IS UNTOUCHABLE FROM HERE, structurally and not by care: colour lives
 * in `palette`, a separate object in both engines, and nothing in this feature
 * reads or writes it.
 *
 * Free of `server-only` and of Prisma: the admin form and the writer both need
 * the same shape.
 */

export interface PresetRole {
  family: string;
  weight: number;
}

export interface TypographyPreset {
  /** Arabic headings — the couple's names, the big lines. */
  display: PresetRole;
  /** Arabic body text — the invitation wording, the details. */
  body: PresetRole;
  /** The Latin face, for English names and dates. */
  latin: PresetRole;
}

export const PRESET_ROLE_KEYS = ["display", "body", "latin"] as const;
export type PresetRoleKey = (typeof PRESET_ROLE_KEYS)[number];

/** Until an admin sets one, the house typeface is the builder's own default. */
export const DEFAULT_TYPOGRAPHY_PRESET: TypographyPreset = {
  display: { ...DEFAULT_TYPOGRAPHY_DOC.roles.display },
  body: { ...DEFAULT_TYPOGRAPHY_DOC.roles.body },
  latin: { ...DEFAULT_TYPOGRAPHY_DOC.roles.latin },
};

function parseRole(value: unknown, fallback: PresetRole): PresetRole {
  if (!value || typeof value !== "object") return fallback;
  const role = value as { family?: unknown; weight?: unknown };
  const family = typeof role.family === "string" && role.family.trim() ? role.family.trim() : null;
  const weight = Number(role.weight);
  return {
    family: family ?? fallback.family,
    weight: Number.isFinite(weight) && weight > 0 ? weight : fallback.weight,
  };
}

/** Lenient on purpose: a stored preset must never be the reason a page fails to render. */
export function parseTypographyPreset(raw: unknown): TypographyPreset {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return DEFAULT_TYPOGRAPHY_PRESET;
    }
  }
  if (!value || typeof value !== "object") return DEFAULT_TYPOGRAPHY_PRESET;
  const record = value as Record<string, unknown>;
  return {
    display: parseRole(record.display, DEFAULT_TYPOGRAPHY_PRESET.display),
    body: parseRole(record.body, DEFAULT_TYPOGRAPHY_PRESET.body),
    latin: parseRole(record.latin, DEFAULT_TYPOGRAPHY_PRESET.latin),
  };
}

/** The preset as a builder theme's typography document. */
export function presetToTypographyDoc(preset: TypographyPreset): TypographyDoc {
  return {
    version: DEFAULT_TYPOGRAPHY_DOC.version,
    roles: {
      display: { ...preset.display },
      body: { ...preset.body },
      latin: { ...preset.latin },
    },
  };
}

/**
 * The preset as a hand-coded design's `config.fonts`.
 *
 * Families only — that shape has never carried a weight, and the weight of a
 * hand-coded design's text is written into its components. Which is why the
 * form says so: weight reaches builder designs and stops there.
 */
export function presetToLegacyFonts(preset: TypographyPreset) {
  return {
    arabicDisplay: preset.display.family,
    arabicBody: preset.body.family,
    latinDisplay: preset.latin.family,
  };
}
