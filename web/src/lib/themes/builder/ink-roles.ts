/**
 * Upgrading stored documents to palette colour roles — schema v3.
 *
 * Until v3 every colour in a layout was a hex literal. The legacy importer
 * baked in the palette of whichever colour a design happened to be converted
 * on, and the stock flow layers shipped one brown for every design. A colour
 * added later inherited all of it: its own "النص" and "نص ثانوي" were never
 * read by a single text box, which is the "my text colours are not the ones I
 * set" complaint this file answers.
 *
 * This pass rewrites those literals as `@role` references (see `ColorRef`) so
 * each colour of a design renders in its own ink. It is deliberately
 * conservative — a literal it cannot attribute to a palette slot, a known
 * stock constant, or a known stock layer stays a literal and is listed in
 * `kept` — and it is pure, so the same input always yields the same document.
 * It runs once per theme from the server loaders (`ink-roles-server.ts`),
 * gated on the document version.
 */

import type { LayoutOverrides } from "@/lib/themes/builder/resolve";
import {
  LAYER_COLOR_KEYS,
  TEXT_STYLE_KEYS,
  colorRoleOf,
  isColorRole,
  roleRef,
  type Layer,
  type LayerColorKey,
  type LayoutDoc,
  type PaletteRole,
  type VariantPalette,
} from "@/lib/themes/builder/types";

/** Documents below this version still carry hex ink. */
export const INK_ROLES_VERSION = 3;

export interface InkVariant {
  id: string;
  palette: VariantPalette;
  overrides: LayoutOverrides;
  isDefault: boolean;
  sortOrder: number;
}

export interface InkChange {
  /** `null` for the shared layout, otherwise the variant whose paint changed. */
  variantId: string | null;
  layerId: string;
  /** Dotted path inside the layer, e.g. `style.color` or `borderColor`. */
  path: string;
  from: string;
  /** The role written, or `null` when a variant's own paint was dropped as redundant. */
  to: string | null;
}

export interface InkKept {
  variantId: string | null;
  layerId: string;
  path: string;
  value: string;
}

export interface InkUpgrade {
  layout: LayoutDoc;
  /** Only the variants whose overrides changed, keyed by variant id. */
  overrides: Map<string, LayoutOverrides>;
  changes: InkChange[];
  /** Literals the pass could not attribute; left exactly as they were. */
  kept: InkKept[];
}

export function needsInkRoles(doc: LayoutDoc): boolean {
  return doc.version < INK_ROLES_VERSION;
}

// ---------------------------------------------------------------------------
// What a literal may be read as
// ---------------------------------------------------------------------------

/**
 * A colour's job on its layer decides which palette slots it could have been
 * copied from: a border was never the page background, a fill was never the
 * primary ink. Matching only within the job is what keeps a white button
 * background from turning into "@accentFg" on a design whose accent text is
 * cream.
 */
type ColorKind = "text" | "accent" | "accentFg" | "border" | "fill" | "qrInk";

const KIND_OF_KEY: Record<LayerColorKey, ColorKind> = {
  background: "fill",
  borderColor: "border",
  boxColor: "fill",
  fgColor: "qrInk",
  fieldBackground: "fill",
  accent: "accent",
  accentFg: "accentFg",
};

/** Palette slots a literal of each kind may be read as, most likely first. */
const CANDIDATES: Record<ColorKind, readonly PaletteRole[]> = {
  text: ["fg", "fgMuted", "accent"],
  accent: ["accent"],
  accentFg: ["accentFg", "surface"],
  border: ["accent", "fgMuted", "fg"],
  fill: ["surface", "bg"],
  // A QR is scanned, not read: its modules stay whatever dark literal they
  // are. A palette with pale ink (the rose family) would make it unreadable.
  qrInk: [],
};

/**
 * Colours earlier code generations wrote as constants. Reading one of these
 * as a role is as safe as a palette match: nobody chose them, they were the
 * default — and every design got the same brown regardless of its palette.
 */
const STOCK: Record<ColorKind, Record<string, PaletteRole>> = {
  text: {
    // default-flow.ts / starter-layout.ts ink
    "#5C4526": "fg",
    "#8C7248": "fgMuted",
    // DEFAULT_PALETTE
    "#4A3B2A": "fg",
    "#8A7860": "fgMuted",
    // DEFAULT_TEXT_STYLE before v3
    "#000000": "fg",
    // layer-factory.ts countdown labels
    "#6B6055": "fgMuted",
    // NOT the rose browns (#3D2417 …): they sit on a cream card whose
    // palette describes pale ink over the dark page. See legacy-import.ts.
  },
  accent: { "#9A754D": "accent", "#B08D57": "accent" },
  accentFg: { "#FFFFFF": "accentFg" },
  border: { "#8C7248": "fgMuted", "#B08D57": "accent" },
  // layer-factory.ts button background before v3
  fill: { "#B08D57": "accent" },
  qrInk: {},
};

/**
 * Layers the importer and the starter wrote with a known job, for literals
 * that match neither a palette nor a stock constant — a design converted on a
 * palette the admin has since changed. The ids are stable by contract (see
 * legacy-import.ts / starter-layout.ts), so the job is knowable from the id.
 */
const STOCK_LAYER_TEXT_ROLE: Record<string, PaletteRole> = {
  li_cover_monogram: "accent",
  li_open_label: "fgMuted",
  li_open_guest: "fg",
  li_open_welcome: "fgMuted",
  li_pass_invitation: "fgMuted",
  li_pass_couple: "fg",
  li_pass_godwilling: "fgMuted",
  li_pass_place: "fg",
  li_pass_date: "fg",
  li_pass_time: "fg",
  s_cover_seal: "fg",
  s_open_guest_label: "fgMuted",
  s_open_guest_name: "fg",
  s_open_invitation_text: "fgMuted",
  s_pass_couple: "fg",
  s_pass_details: "fgMuted",
  s_pass_guest: "fg",
};


/**
 * legacy-import.ts's rose-emboss inks: browns hardcoded on the cream card of
 * a design whose palette is pale ink over the dark page. Never read as a role
 * on a stock layer's say-so alone — see the STOCK comment above.
 */
const ROSE_INKS = new Set(["#3D2417", "#5B3A22", "#8A5A3A", "#6B4530"]);

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** `#abc` and `#AABBCC` compare equal; alpha is part of the identity. */
function normalizeHex(value: string): string {
  const raw = value.trim().toUpperCase();
  if (/^#[0-9A-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return raw;
}

/**
 * A button's label is the one text that is usually the accent's own
 * foreground; reading a white heading elsewhere as "@accentFg" would turn it
 * near-black on a design whose accent text is dark.
 */
function candidatesFor(kind: ColorKind, layerType: string): readonly PaletteRole[] {
  if (kind === "text" && layerType === "button") return [...CANDIDATES.text, "accentFg"];
  return CANDIDATES[kind];
}

function paletteRoleFor(
  literal: string,
  kind: ColorKind,
  layerType: string,
  palettes: readonly VariantPalette[],
): PaletteRole | null {
  const wanted = normalizeHex(literal);
  // Role priority over variant priority: a literal that is the primary ink of
  // ANY colour reads as "@fg" even if it is also the muted ink of another.
  for (const role of candidatesFor(kind, layerType)) {
    for (const palette of palettes) {
      if (normalizeHex(palette[role]) === wanted) return role;
    }
  }
  return null;
}

function stockRoleFor(literal: string, kind: ColorKind): PaletteRole | null {
  return STOCK[kind][normalizeHex(literal)] ?? null;
}

function stockLayerRoleFor(layerId: string, kind: ColorKind): PaletteRole | null {
  if (kind === "text") return STOCK_LAYER_TEXT_ROLE[layerId] ?? null;
  return null;
}

/**
 * The role a shared-layout literal becomes, or null to keep it.
 *
 * A stock layer's known job is tried FIRST, confirmed against the palettes:
 * the muted ink the importer wrote on "دعوة خاصة إلى" reads as `@fgMuted`
 * even when some other colour of the design happens to use that very hex as
 * its primary ink. Only then does the generic match run, then the stock
 * constants, and finally the job on its own for a literal from a palette the
 * admin has since changed.
 */
function layoutRoleFor(
  literal: string,
  kind: ColorKind,
  layer: { id: string; type: string },
  palettes: readonly VariantPalette[],
): PaletteRole | null {
  const job = stockLayerRoleFor(layer.id, kind);
  if (job && candidatesFor(kind, layer.type).includes(job)) {
    const wanted = normalizeHex(literal);
    if (palettes.some((palette) => normalizeHex(palette[job]) === wanted)) return job;
  }
  const confirmed = paletteRoleFor(literal, kind, layer.type, palettes) ?? stockRoleFor(literal, kind);
  if (confirmed) return confirmed;
  // The job alone is a guess; the rose browns are the literal it is known to
  // guess wrong.
  return ROSE_INKS.has(normalizeHex(literal)) ? null : job;
}

/**
 * The role a variant's OWN paint literal becomes, or null to keep it. Only
 * that variant's palette counts here: the paint was written while looking at
 * this colour, so a match against it is what the admin meant.
 */
function paintRoleFor(
  literal: string,
  kind: ColorKind,
  layerType: string,
  palette: VariantPalette,
): PaletteRole | null {
  return paletteRoleFor(literal, kind, layerType, [palette]) ?? stockRoleFor(literal, kind);
}

// ---------------------------------------------------------------------------
// Walking a layer / a paint patch
// ---------------------------------------------------------------------------

interface ColorLeaf {
  path: string;
  kind: ColorKind;
  value: string;
}

/** Every colour leaf on a layer or on a paint patch shaped like one. */
function colorLeaves(source: Record<string, unknown>): ColorLeaf[] {
  const leaves: ColorLeaf[] = [];
  for (const key of LAYER_COLOR_KEYS) {
    const value = source[key];
    if (typeof value === "string") leaves.push({ path: key, kind: KIND_OF_KEY[key], value });
  }
  for (const key of TEXT_STYLE_KEYS) {
    const style = source[key];
    if (!style || typeof style !== "object") continue;
    const color = (style as { color?: unknown }).color;
    if (typeof color === "string") leaves.push({ path: `${key}.color`, kind: "text", value: color });
  }
  return leaves;
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  const [head, tail] = path.split(".");
  const value = source[head];
  if (tail === undefined) return value;
  return value && typeof value === "object" ? (value as Record<string, unknown>)[tail] : undefined;
}

function writePath(target: Record<string, unknown>, path: string, value: string): void {
  const [head, tail] = path.split(".");
  if (tail === undefined) {
    target[head] = value;
    return;
  }
  const nested = target[head];
  target[head] = { ...(nested && typeof nested === "object" ? (nested as object) : {}), [tail]: value };
}

function deletePath(target: Record<string, unknown>, path: string): void {
  const [head, tail] = path.split(".");
  if (tail === undefined) {
    delete target[head];
    return;
  }
  const nested = target[head];
  if (!nested || typeof nested !== "object") return;
  const copy = { ...(nested as Record<string, unknown>) };
  delete copy[tail];
  if (Object.keys(copy).length === 0) delete target[head];
  else target[head] = copy;
}

// ---------------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------------

/**
 * Rewrite the shared layout's literals as roles, then reconcile each variant's
 * own paint against the result: a paint literal that names one of the
 * variant's own colours becomes that role, and a paint that now merely repeats
 * what the shared layout resolves to is dropped. Anything else — a monogram
 * hand-tinted to a colour that is on no palette — is left alone.
 *
 * A document already at v3 (or beyond) is returned untouched.
 */
export function adoptPaletteRoles(layout: LayoutDoc, variants: readonly InkVariant[]): InkUpgrade {
  if (!needsInkRoles(layout)) {
    return { layout, overrides: new Map(), changes: [], kept: [] };
  }

  const ordered = [...variants].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder,
  );
  const palettes = ordered.map((v) => v.palette);
  const changes: InkChange[] = [];
  const kept: InkKept[] = [];

  const layers = layout.layers.map((layer): Layer => {
    const source = layer as unknown as Record<string, unknown>;
    let draft: Record<string, unknown> | null = null;
    for (const leaf of colorLeaves(source)) {
      if (isColorRole(leaf.value)) continue;
      const role = layoutRoleFor(leaf.value, leaf.kind, layer, palettes);
      if (!role) {
        kept.push({ variantId: null, layerId: layer.id, path: leaf.path, value: leaf.value });
        continue;
      }
      draft ??= { ...source };
      writePath(draft, leaf.path, roleRef(role));
      changes.push({ variantId: null, layerId: layer.id, path: leaf.path, from: leaf.value, to: roleRef(role) });
    }
    return (draft ?? source) as unknown as Layer;
  });

  const byId = new Map(layers.map((layer) => [layer.id, layer as unknown as Record<string, unknown>]));
  const overrides = new Map<string, LayoutOverrides>();

  for (const variant of ordered) {
    let touched = false;
    const next: LayoutOverrides = { ...variant.overrides };

    for (const [layerId, override] of Object.entries(variant.overrides)) {
      if (!override?.paint) continue;
      const layer = byId.get(layerId);
      // Paint for a layer the design no longer has: not ours to judge.
      if (!layer) continue;

      const paint: Record<string, unknown> = { ...override.paint };
      let paintTouched = false;

      for (const leaf of colorLeaves(paint)) {
        if (isColorRole(leaf.value)) continue;
        const role = paintRoleFor(leaf.value, leaf.kind, String(layer.type), variant.palette);
        if (!role) {
          kept.push({ variantId: variant.id, layerId, path: leaf.path, value: leaf.value });
          continue;
        }
        const shared = readPath(layer, leaf.path);
        const sharedRole = typeof shared === "string" ? colorRoleOf(shared) : null;
        if (sharedRole === role) {
          // The design already says this; the paint only repeated it in hex.
          deletePath(paint, leaf.path);
          changes.push({ variantId: variant.id, layerId, path: leaf.path, from: leaf.value, to: null });
        } else {
          writePath(paint, leaf.path, roleRef(role));
          changes.push({ variantId: variant.id, layerId, path: leaf.path, from: leaf.value, to: roleRef(role) });
        }
        paintTouched = true;
      }

      if (!paintTouched) continue;
      touched = true;
      const { paint: _dropped, ...geometry } = override;
      void _dropped;
      const entry: LayoutOverrides[string] =
        Object.keys(paint).length > 0 ? { ...geometry, paint } : { ...geometry };
      if (Object.keys(entry).length === 0) delete next[layerId];
      else next[layerId] = entry;
    }

    if (touched) overrides.set(variant.id, next);
  }

  return {
    layout: { ...layout, version: INK_ROLES_VERSION, layers },
    overrides,
    changes,
    kept,
  };
}
