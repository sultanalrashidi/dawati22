import "server-only";
import { prisma } from "@/lib/db/client";
import { Prisma, ThemeEngine, ThemeStatus } from "@/generated/prisma/client";
import { ThemeAdminError } from "@/lib/admin/themes/service";
import { removeStoredAsset } from "@/lib/admin/themes/storage";
import { assertLayoutDoc, assertPalette, assertTypographyDoc } from "@/lib/themes/builder/schema";
import {
  BUILDER_SCHEMA_VERSION,
  DEFAULT_ANIMATION,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  type Layer,
  type LayoutDoc,
  type SceneCanvas,
  type TextStyle,
  type Transform,
  type TransformOverride,
  type TypographyDoc,
  type VariantPalette,
} from "@/lib/themes/builder/types";
import { FLOW_SCENE_TEMPLATES, defaultFlowLayers } from "@/lib/themes/builder/default-flow";
import type { ThemeConfig } from "@/lib/themes/types";

/**
 * Importing a hand-coded artwork theme into the visual editor.
 *
 * 27 LEGACY themes carry bespoke card art (`ThemeConfig.card`), drawn by three
 * hand-written renderers — `sealed-card.tsx`, the opened-card branches of
 * `invitation-view.tsx`, and the two `*-pass.tsx` components. Their geometry
 * lives partly in those files' Tailwind classes and partly in `config.card
 * .layout`, so an admin cannot move a single element without a deploy.
 *
 * This module rewrites that geometry as a builder `LayoutDoc`: every number the
 * renderers use is translated once, here, into the builder's centre-anchored
 * percentages, and from then on the design is edited like any other.
 *
 * Two properties make the conversion safe to try:
 *
 * - `Theme.config` is left EXACTLY as it was. Only `engine` flips, so
 *   `revertLegacyImport` puts the theme back on the hand-coded path by
 *   flipping it back and dropping the rows created here.
 * - The `ThemeAsset` rows point at the git-tracked files already under
 *   `public/themes/<assetFolder>/`, with a NULL `blobPath` — see
 *   `staticAsset` below.
 */

const json = (value: unknown) => value as Prisma.InputJsonValue;

// ---------------------------------------------------------------------------
// The legacy renderers' own measurements
// ---------------------------------------------------------------------------

/** `ThemeStage` sizes type in px against a stage this wide, then scales it. */
const BUILDER_REFERENCE_WIDTH = 390;

/**
 * The CSS px width each legacy card is laid out at on a 390px phone — the
 * denominator that turns its fixed `text-[10px]`/`text-lg` sizes into the
 * stage-relative proportions the builder stores.
 *
 * - cover: `w-72` on `SealedCard`'s two card components.
 * - open: the hardcoded `w-[320px]` / `w-[370px]` wrappers in invitation-view.
 * - pass: the pass art is `w-auto` under Tailwind's `img { max-width: 100% }`,
 *   so it fills `.dawati-scene`'s content box — 390 minus its 1.5rem padding.
 */
const LEGACY_COVER_WIDTH = 288;
const LEGACY_BRIDAL_OPEN_WIDTH = 320;
const LEGACY_ROSE_OPEN_WIDTH = 370;
const LEGACY_PASS_WIDTH = 342;

/** `BRIDAL_FRAME_DEFAULT_*` in sealed-card.tsx. */
const BRIDAL_DEFAULT_CLOSED_ASPECT = "1200/727";
const BRIDAL_DEFAULT_SEAL_POSITION = { left: "50%", top: "62.8%" };
const BRIDAL_DEFAULT_SEAL_FONT_SIZE = "clamp(1rem, 4.5vw, 1.125rem)";
/** invitation-view.tsx's fallback when `card.layout.openTextZone` is absent. */
const BRIDAL_DEFAULT_OPEN_TEXT_ZONE = { insetX: "24%", top: "15%", bottom: "30%" };
/** `BridalFramePass`'s own defaults. */
const BRIDAL_DEFAULT_PASS = {
  textTop: "23%",
  iconsTop: "43%",
  qr: { left: "38.75%", width: "24.25%", top: "79.7%", height: "10.7%" },
};

/** `RoseEmbossCard` — a fixed box, a 64px wax medallion at 68%, initials at 47% of it. */
const ROSE_CLOSED_ASPECT = "1426/1103";
const ROSE_SEAL_TOP_PCT = 68;
const ROSE_SEAL_SIZE_PX = 64;
const ROSE_SEAL_INITIALS_TOP_PCT = 47;
/** The rose open card's zone: `inset-x-[18%] top-[37%]`, no bottom. */
const ROSE_OPEN_ZONE = { insetX: 18, top: 37 };
/** `RoseCandlelightPass` — every hotspot hardcoded, no per-variant override. */
const ROSE_PASS = {
  textInsetX: 19,
  textTop: 28.5,
  iconsInsetX: 12.7,
  iconsTop: 45.1,
  gapPx: 4,
  qr: { left: 32.3, width: 35.5, top: 63, height: 24 },
};
const BRIDAL_PASS_TEXT_INSET_X = 16;
const BRIDAL_PASS_ICONS_INSET_X = 14;
const BRIDAL_PASS_GAP_PX = 6;

/**
 * Ink is written as palette ROLES, not as the palette's hex: the layout is
 * shared by every colour of the design, so baking `source.palette.fg` in
 * would hand every later colour the first colour's ink.
 *
 * The rose designs are the exception, on purpose. Their palettes describe
 * text over the DARK page (`fg` is a pale pink or mint), while the card the
 * text actually sits on is cream — which is why the rose renderers always
 * hardcoded these browns. A role would set pale ink on a cream card, so a
 * rose conversion keeps the browns as literals; the admin can point any line
 * at a palette slot from the inspector when a rose palette is reworked.
 */
const INK_PRIMARY = "@fg";
const INK_MUTED = "@fgMuted";
const INK_ACCENT = "@accent";
const ROSE_INK_DARK = "#3d2417";
const ROSE_INK_MID = "#5b3a22";
const ROSE_INK_LIGHT = "#8a5a3a";
const ROSE_OPEN_WELCOME_INK = "#6b4530";

/**
 * A QR is scanned, not read: its modules must stay dark whatever the palette
 * says, so this is always a literal. The design's own ink is used when it is
 * dark enough to scan, near-black otherwise (a pale `fg` over the printed
 * white window would be a code no phone can read).
 */
function qrInk(fg: string): string {
  const raw = fg.replace("#", "");
  const hex = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return Number.isFinite(luminance) && luminance < 0.35 ? fg : "#1A1A1A";
}

/**
 * Line boxes of the legacy type, in CSS px on their own card.
 *
 * Tailwind's arbitrary `text-[10px]` sets a size and no leading, so the browser
 * default (~1.2) applies; the classed sizes carry their own (`leading-snug`
 * 1.375, `leading-relaxed` 1.625, `leading-tight` 1.25, `text-base` 1.5).
 */
const OPEN_LABEL = { size: 10, leading: 1.4, tracking: 0.3 };
const OPEN_NAME = { size: 18, sizeSm: 20, leading: 1.375 };
const OPEN_WELCOME = { size: 11, sizeSm: 12, leading: 1.625 };
const OPEN_GAP_PX = 6;

const PASS_INVITATION = { size: 9, sizeSm: 10, leading: 1.375 };
const PASS_NAMES = { size: 16, sizeSm: 18, leading: 1.5, marginTop: 2 };
const PASS_GOD_WILLING = { size: 9, sizeSm: 10, leading: 1.2 };
/** One `InfoColumn`: `h-3.5` icon, gap, 7.5px label, gap, 8px value. */
const PASS_INFO_COLUMN = { valueSize: 8, valueLeading: 1.5, heightPx: 37, tracking: 0.025 };

/** Seeded from the guest dictionary; static text layers, so now editable. */
const COPY_GUEST_OF = "دعوة خاصة إلى";
const COPY_GUEST_WELCOME = "نتشرف بحضوركم";
const COPY_GOD_WILLING = "وذلك بمشيئة الله تعالى";
const COPY_PLACE = "المكان";
const COPY_DATE = "التاريخ";
const COPY_TIME = "الوقت";

/** `WaxSeal` prints the initials in Cormorant directly, not the theme's latin role. */
const ROSE_MONOGRAM_FAMILY = "Cormorant Garamond";

// ---------------------------------------------------------------------------
// Art proportions
// ---------------------------------------------------------------------------

/**
 * Pixel proportions of the committed art, per asset folder.
 *
 * The open and pass scenes are laid out as percentages of an image drawn at its
 * natural aspect ratio, so the builder stage has to adopt that ratio or every
 * translated percentage lands somewhere else. These files are git-tracked and
 * shipped with the code, and `public/` is not a readable filesystem on the
 * Workers runtime the admin panel deploys to — so the proportions travel with
 * the importer rather than being measured at request time. A folder missing
 * here falls back to the base art's ratio, which the admin can then correct in
 * the editor; that is the whole point of converting.
 */
const ART_ASPECT: Record<string, { open: Aspect; pass: Aspect }> = {
  "champagne-tassel": { open: { w: 1222, h: 1287 }, pass: { w: 1086, h: 1448 } },
  "gilded-tassel": { open: { w: 1229, h: 1280 }, pass: { w: 1054, h: 1493 } },
  "ivory-bloom": { open: { w: 781, h: 1108 }, pass: { w: 800, h: 1200 } },
  "ivory-bloom-burgundy": { open: { w: 1082, h: 1180 }, pass: { w: 675, h: 1200 } },
  "ivory-bloom-mauve": { open: { w: 1114, h: 1200 }, pass: { w: 800, h: 1200 } },
  "ivory-bloom-mocha": { open: { w: 1097, h: 1180 }, pass: { w: 675, h: 1200 } },
  "ivory-bloom-navy": { open: { w: 1130, h: 1194 }, pass: { w: 675, h: 1200 } },
  "ivory-bloom-rose": { open: { w: 985, h: 1173 }, pass: { w: 800, h: 1200 } },
  "ivory-bloom-sage": { open: { w: 1066, h: 1180 }, pass: { w: 800, h: 1200 } },
  "ivory-bloom-sand": { open: { w: 781, h: 1108 }, pass: { w: 800, h: 1200 } },
  "ivory-bloom-sky": { open: { w: 1068, h: 1180 }, pass: { w: 800, h: 1200 } },
  "marble-bloom": { open: { w: 1024, h: 1536 }, pass: { w: 1024, h: 1536 } },
  "pearl-lace": { open: { w: 1024, h: 1536 }, pass: { w: 1086, h: 1448 } },
  "pearl-lace-black": { open: { w: 1024, h: 1536 }, pass: { w: 1086, h: 1448 } },
  "pearl-lace-blush": { open: { w: 1024, h: 1536 }, pass: { w: 1086, h: 1448 } },
  "pearl-lace-champagne": { open: { w: 1024, h: 1536 }, pass: { w: 1086, h: 1448 } },
  "pearl-lace-sage": { open: { w: 1024, h: 1536 }, pass: { w: 1086, h: 1448 } },
  "porcelain-seal": { open: { w: 1024, h: 1536 }, pass: { w: 1023, h: 1537 } },
  "ribbon-bloom": { open: { w: 1224, h: 1285 }, pass: { w: 1024, h: 1536 } },
  "rose-blush": { open: { w: 1404, h: 1120 }, pass: { w: 1054, h: 1492 } },
  "rose-candlelight": { open: { w: 1404, h: 1120 }, pass: { w: 1054, h: 1492 } },
  "rose-charcoal": { open: { w: 1404, h: 1120 }, pass: { w: 1054, h: 1492 } },
  "rose-emerald": { open: { w: 1404, h: 1120 }, pass: { w: 1054, h: 1492 } },
  "rose-navy": { open: { w: 1404, h: 1120 }, pass: { w: 1054, h: 1492 } },
  "rose-purple": { open: { w: 1404, h: 1120 }, pass: { w: 1054, h: 1492 } },
  "sapphire-bloom": { open: { w: 1224, h: 1285 }, pass: { w: 1086, h: 1448 } },
};

const FALLBACK_ART_ASPECT: Record<CardStyle, { open: Aspect; pass: Aspect }> = {
  "bridal-frame": ART_ASPECT["ivory-bloom"],
  "rose-emboss": ART_ASPECT["rose-candlelight"],
};

// ---------------------------------------------------------------------------
// Small geometry helpers
// ---------------------------------------------------------------------------

export type CardStyle = "bridal-frame" | "rose-emboss";

interface Aspect {
  w: number;
  h: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** `"62.8%"` → `62.8`. */
function pct(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value.trim().replace("%", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `"1200/727"` → `{ w: 1200, h: 727 }`. */
function aspect(value: string | undefined, fallback: Aspect): Aspect {
  if (!value) return fallback;
  const [w, h] = value.split("/").map((part) => Number.parseFloat(part.trim()));
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : fallback;
}

/**
 * A CSS length as px on a 390px phone — enough of a parser for the shapes the
 * theme configs actually use: `clamp(min, Nvw, max)`, `rem`, `px` and `vw`.
 */
function cssLengthPx(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const text = value.trim();
  const clamp = /^clamp\(([^,]+),([^,]+),([^)]+)\)$/.exec(text);
  if (clamp) {
    const min = cssLengthPx(clamp[1], fallback);
    const preferred = cssLengthPx(clamp[2], fallback);
    const max = cssLengthPx(clamp[3], fallback);
    return Math.min(Math.max(preferred, min), max);
  }
  const number = Number.parseFloat(text);
  if (!Number.isFinite(number)) return fallback;
  if (text.endsWith("rem") || text.endsWith("em")) return number * 16;
  if (text.endsWith("vw")) return (number * BUILDER_REFERENCE_WIDTH) / 100;
  return number;
}

/**
 * How one variant's art sits inside the shared stage.
 *
 * Merging a colour family puts several images with different proportions on one
 * stage, and a scene canvas is document-level — there is no per-variant aspect
 * ratio. So the stage takes the TALLEST art in the family and every asset layer
 * is `contain`: each image then fills the stage width exactly (`scaleX === 1`)
 * and is letterbox-centred vertically, which keeps type — sized against the
 * stage width — at the same proportion of the art it had before, for every
 * colour. Shorter art shows the page background above and below it, exactly as
 * the legacy card floated on that same background.
 */
interface ArtFrame {
  /** % of stage height above the drawn art. */
  offsetY: number;
  /** Drawn art height, as % of stage height. */
  scaleY: number;
  offsetX: number;
  scaleX: number;
  /** The art's own height in legacy CSS px, for converting px offsets. */
  artHeightPx: number;
}

function artFrame(stage: Aspect, art: Aspect, artWidthPx: number): ArtFrame {
  const stageRatio = stage.w / stage.h;
  const artRatio = art.w / art.h;
  // `contain`: the wider ratio is the one limited by the stage width.
  const widthLimited = artRatio >= stageRatio;
  const scaleX = widthLimited ? 100 : (artRatio / stageRatio) * 100;
  const scaleY = widthLimited ? (stageRatio / artRatio) * 100 : 100;
  return {
    offsetX: (100 - scaleX) / 2,
    scaleX,
    offsetY: (100 - scaleY) / 2,
    scaleY,
    artHeightPx: (artWidthPx * art.h) / art.w,
  };
}

/** A percentage of the art's width/height, as a percentage of the stage. */
const mapX = (f: ArtFrame, p: number) => f.offsetX + (p * f.scaleX) / 100;
const mapY = (f: ArtFrame, p: number) => f.offsetY + (p * f.scaleY) / 100;
const mapW = (f: ArtFrame, p: number) => (p * f.scaleX) / 100;
const mapH = (f: ArtFrame, p: number) => (p * f.scaleY) / 100;
/** A CSS px length on the legacy card, as a percentage of the art's height. */
const pxH = (f: ArtFrame, px: number) => (px / f.artHeightPx) * 100;

/**
 * A legacy px font size as the builder's px-at-390px-stage.
 *
 * Both engines end up expressing type as a fraction of the card's width — the
 * legacy one implicitly (fixed px on a fixed-width card), the builder one
 * explicitly (`cqw` against the stage) — so the conversion is one ratio.
 */
const fontPx = (px: number, cardWidthPx: number) =>
  Math.max(4, round2((px * BUILDER_REFERENCE_WIDTH) / cardWidthPx));

function transform(input: Partial<Transform>): Transform {
  return { ...DEFAULT_TRANSFORM, ...input };
}

function textStyle(input: Partial<TextStyle>): TextStyle {
  return { ...DEFAULT_TEXT_STYLE, ...input };
}

// ---------------------------------------------------------------------------
// Layer ids — stable, so a re-import or a variant override still lines up
// ---------------------------------------------------------------------------

const L = {
  coverEnvelope: "li_cover_envelope",
  coverSeal: "li_cover_seal",
  coverMonogram: "li_cover_monogram",
  openEnvelope: "li_open_envelope",
  openLabel: "li_open_label",
  openGuest: "li_open_guest",
  openWelcome: "li_open_welcome",
  passCard: "li_pass_card",
  passInvitation: "li_pass_invitation",
  passCouple: "li_pass_couple",
  passGodWilling: "li_pass_godwilling",
  passPlace: "li_pass_place",
  passDate: "li_pass_date",
  passTime: "li_pass_time",
  passQr: "li_pass_qr",
} as const;

// ---------------------------------------------------------------------------
// Per-variant source geometry
// ---------------------------------------------------------------------------

/** Everything one legacy row contributes to the merged design. */
interface VariantSource {
  themeId: string;
  slug: string;
  name: string;
  nameAr: string;
  status: ThemeStatus;
  colorTag: string | null;
  palette: VariantPalette;
  folder: string;
  closed: Aspect;
  openArt: Aspect;
  passArt: Aspect;
  sealPosition: { left: number; top: number };
  sealFontPx: number;
  /** `bottom` is null when the legacy zone pins only its top edge. */
  openZone: { insetX: number; top: number; bottom: number | null };
  pass: {
    textTop: number;
    iconsTop: number;
    qr: { left: number; width: number; top: number; height: number };
  };
}

function readVariantSource(row: {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  status: ThemeStatus;
  config: unknown;
}): VariantSource {
  const config = row.config as unknown as ThemeConfig;
  const card = config.card;
  if (!card?.style) throw new ThemeAdminError(`التصميم «${row.nameAr}» ما فيه رسومات بطاقة`);

  const style = card.style;
  const folder = card.assetFolder ?? "rose-candlelight";
  const art = ART_ASPECT[folder] ?? FALLBACK_ART_ASPECT[style];
  const layout = card.layout;

  return {
    themeId: row.id,
    slug: row.slug,
    name: row.name,
    nameAr: row.nameAr,
    status: row.status,
    colorTag: config.colorTag ?? null,
    palette: assertPalette(config.palette),
    folder,
    closed:
      style === "rose-emboss"
        ? aspect(ROSE_CLOSED_ASPECT, { w: 1426, h: 1103 })
        : aspect(layout?.closedAspect, aspect(BRIDAL_DEFAULT_CLOSED_ASPECT, { w: 1200, h: 727 })),
    openArt: art.open,
    passArt: art.pass,
    sealPosition:
      style === "rose-emboss"
        ? { left: 50, top: ROSE_SEAL_TOP_PCT }
        : {
            left: pct(layout?.sealPosition?.left, pct(BRIDAL_DEFAULT_SEAL_POSITION.left, 50)),
            top: pct(layout?.sealPosition?.top, pct(BRIDAL_DEFAULT_SEAL_POSITION.top, 62.8)),
          },
    sealFontPx:
      style === "rose-emboss"
        ? 18 // `text-lg` on the wax medallion
        : cssLengthPx(layout?.sealFontSize, cssLengthPx(BRIDAL_DEFAULT_SEAL_FONT_SIZE, 17.55)),
    openZone:
      style === "rose-emboss"
        ? { insetX: ROSE_OPEN_ZONE.insetX, top: ROSE_OPEN_ZONE.top, bottom: null }
        : {
            insetX: pct(layout?.openTextZone?.insetX, pct(BRIDAL_DEFAULT_OPEN_TEXT_ZONE.insetX, 24)),
            top: pct(layout?.openTextZone?.top, pct(BRIDAL_DEFAULT_OPEN_TEXT_ZONE.top, 15)),
            bottom: pct(layout?.openTextZone?.bottom, pct(BRIDAL_DEFAULT_OPEN_TEXT_ZONE.bottom, 30)),
          },
    pass:
      style === "rose-emboss"
        ? { textTop: ROSE_PASS.textTop, iconsTop: ROSE_PASS.iconsTop, qr: ROSE_PASS.qr }
        : {
            textTop: pct(layout?.pass?.textTop, pct(BRIDAL_DEFAULT_PASS.textTop, 23)),
            iconsTop: pct(layout?.pass?.iconsTop, pct(BRIDAL_DEFAULT_PASS.iconsTop, 43)),
            qr: {
              left: pct(layout?.pass?.qr?.left, pct(BRIDAL_DEFAULT_PASS.qr.left, 38.75)),
              width: pct(layout?.pass?.qr?.width, pct(BRIDAL_DEFAULT_PASS.qr.width, 24.25)),
              top: pct(layout?.pass?.qr?.top, pct(BRIDAL_DEFAULT_PASS.qr.top, 79.7)),
              height: pct(layout?.pass?.qr?.height, pct(BRIDAL_DEFAULT_PASS.qr.height, 10.7)),
            },
          },
  };
}

// ---------------------------------------------------------------------------
// Layer construction
// ---------------------------------------------------------------------------

interface Scenes {
  cover: Aspect;
  open: Aspect;
  pass: Aspect;
}

/**
 * A vertically stacked run of lines, the way a `flex-col` with a `gap` lays
 * out — returns each line's centre and height as percentages of the art.
 */
function stack(
  frame: ArtFrame,
  items: { heightPx: number; gapBeforePx: number }[],
  zoneTopPct: number,
  zoneHeightPct: number | null,
): { centre: number; height: number }[] {
  const heights = items.map((item) => pxH(frame, item.heightPx));
  const gaps = items.map((item) => pxH(frame, item.gapBeforePx));
  const total = heights.reduce((sum, h) => sum + h, 0) + gaps.reduce((sum, g) => sum + g, 0);
  // `justify-center` when the zone has both a top and a bottom inset, and
  // `justify-start` (the flex default) when it only has a top.
  let cursor = zoneHeightPct === null ? zoneTopPct : zoneTopPct + (zoneHeightPct - total) / 2;

  return heights.map((height, index) => {
    cursor += gaps[index];
    const centre = cursor + height / 2;
    cursor += height;
    return { centre, height };
  });
}

function buildLayers(source: VariantSource, style: CardStyle, scenes: Scenes): Layer[] {
  return [
    ...coverLayers(source, style, scenes.cover),
    ...openLayers(source, style, scenes.open),
    ...passLayers(source, style, scenes.pass),
  ];
}

/**
 * Cover — `SealedCard`. The card box IS the stage: one full-bleed envelope
 * layer, plus the monogram at `sealPosition` (and, for rose-emboss, the
 * separate wax medallion the initials are pressed into).
 */
function coverLayers(source: VariantSource, style: CardStyle, stage: Aspect): Layer[] {
  const frame = artFrame(stage, source.closed, LEGACY_COVER_WIDTH);
  const monogramFont = fontPx(source.sealFontPx, LEGACY_COVER_WIDTH);
  const layers: Layer[] = [
    {
      id: L.coverEnvelope,
      type: "asset",
      name: "الظرف المغلق",
      slot: "envelopeClosed",
      fit: "contain",
      scene: "cover",
      z: 0,
      visible: true,
      locked: false,
      base: transform({ x: 50, y: 50, width: 100, height: 100 }),
    },
  ];

  // The initials sit at 47% of the medallion, which itself is centred on 68%
  // of the card — so their centre is a whole 3% of the wax above that anchor.
  let monogramTop = source.sealPosition.top;
  if (style === "rose-emboss") {
    const sealHeight = pxH(frame, ROSE_SEAL_SIZE_PX);
    layers.push({
      id: L.coverSeal,
      type: "asset",
      name: "الختم",
      slot: "seal",
      fit: "contain",
      scene: "cover",
      z: 1,
      visible: true,
      locked: false,
      base: transform({
        x: round2(mapX(frame, 50)),
        y: round2(mapY(frame, source.sealPosition.top)),
        width: round2(mapW(frame, (ROSE_SEAL_SIZE_PX / LEGACY_COVER_WIDTH) * 100)),
        height: round2(mapH(frame, sealHeight)),
      }),
    });
    monogramTop =
      source.sealPosition.top - sealHeight / 2 + (sealHeight * ROSE_SEAL_INITIALS_TOP_PCT) / 100;
  }

  layers.push({
    id: L.coverMonogram,
    type: "seal",
    name: "أحرف العروسين",
    scene: "cover",
    z: style === "rose-emboss" ? 2 : 1,
    visible: true,
    locked: false,
    mode: "initials",
    script: "latin",
    // sealed-card.tsx prints `{groomInitial} & {brideInitial}` — matching it
    // matters, or every converted design quietly flips its monogram.
    order: "groom-first",
    text: "",
    separator: "&",
    maxChars: 1,
    style: textStyle({
      font: style === "rose-emboss" ? ROSE_MONOGRAM_FAMILY : "@latin",
      fontSize: monogramFont,
      fontWeight: 500,
      color: INK_ACCENT,
      lineHeight: 1.1,
    }),
    base: transform({
      x: round2(mapX(frame, source.sealPosition.left)),
      y: round2(mapY(frame, monogramTop)),
      // A grab box around the initials: roughly 3.2em by 1.4em of their own type.
      width: round2(mapW(frame, ((source.sealFontPx * 3.2) / LEGACY_COVER_WIDTH) * 100)),
      height: round2(mapH(frame, pxH(frame, source.sealFontPx * 1.4))),
    }),
  });

  return layers;
}

/**
 * Open — the named card. The legacy zone is an inset rectangle holding three
 * centred lines; the builder wants a centre and a size per line, so the insets
 * are resolved into a zone box and the three lines are stacked inside it.
 */
function openLayers(source: VariantSource, style: CardStyle, stage: Aspect): Layer[] {
  const cardWidth = style === "rose-emboss" ? LEGACY_ROSE_OPEN_WIDTH : LEGACY_BRIDAL_OPEN_WIDTH;
  const frame = artFrame(stage, source.openArt, cardWidth);

  const zoneWidth = 100 - 2 * source.openZone.insetX;
  // rose-emboss pins only the top, so its zone has no height to centre in.
  const zoneHeight =
    source.openZone.bottom === null ? null : 100 - source.openZone.top - source.openZone.bottom;

  const [label, name, welcome] = stack(
    frame,
    [
      { heightPx: OPEN_LABEL.size * OPEN_LABEL.leading, gapBeforePx: 0 },
      { heightPx: OPEN_NAME.size * OPEN_NAME.leading, gapBeforePx: OPEN_GAP_PX },
      { heightPx: OPEN_WELCOME.size * OPEN_WELCOME.leading, gapBeforePx: OPEN_GAP_PX },
    ],
    source.openZone.top,
    zoneHeight,
  );

  const rose = style === "rose-emboss";
  const inkLabel = rose ? ROSE_INK_LIGHT : INK_MUTED;
  const inkName = rose ? ROSE_INK_DARK : INK_PRIMARY;
  const inkWelcome = rose ? ROSE_OPEN_WELCOME_INK : INK_MUTED;

  const box = (line: { centre: number; height: number }) =>
    transform({
      x: round2(mapX(frame, 50)),
      y: round2(mapY(frame, line.centre)),
      width: round2(mapW(frame, zoneWidth)),
      height: round2(mapH(frame, line.height)),
    });

  return [
    {
      id: L.openEnvelope,
      type: "asset",
      name: "الظرف المفتوح",
      slot: "envelopeOpen",
      fit: "contain",
      scene: "open",
      z: 0,
      visible: true,
      locked: false,
      base: transform({ x: 50, y: 50, width: 100, height: 100 }),
    },
    {
      id: L.openLabel,
      type: "text",
      name: "سطر «دعوة خاصة إلى»",
      scene: "open",
      z: 1,
      visible: true,
      locked: false,
      source: "static",
      text: COPY_GUEST_OF,
      fields: [],
      style: textStyle({
        font: "@body",
        fontSize: fontPx(OPEN_LABEL.size, cardWidth),
        color: inkLabel,
        lineHeight: OPEN_LABEL.leading,
        letterSpacing: OPEN_LABEL.tracking,
      }),
      base: box(label),
    },
    {
      id: L.openGuest,
      type: "text",
      name: "اسم المدعو",
      scene: "open",
      z: 2,
      visible: true,
      locked: false,
      source: "content",
      text: "",
      fields: ["guestName"],
      style: textStyle({
        font: "@display",
        fontSize: fontPx(OPEN_NAME.size, cardWidth),
        color: inkName,
        lineHeight: OPEN_NAME.leading,
      }),
      tabletStyle: { fontSize: fontPx(OPEN_NAME.sizeSm, cardWidth) },
      base: box(name),
    },
    {
      id: L.openWelcome,
      type: "text",
      name: "سطر الترحيب",
      scene: "open",
      z: 3,
      visible: true,
      locked: false,
      source: "static",
      text: COPY_GUEST_WELCOME,
      fields: [],
      style: textStyle({
        font: "@body",
        fontSize: fontPx(OPEN_WELCOME.size, cardWidth),
        color: inkWelcome,
        lineHeight: OPEN_WELCOME.leading,
      }),
      tabletStyle: { fontSize: fontPx(OPEN_WELCOME.sizeSm, cardWidth) },
      base: box(welcome),
    },
  ];
}

/**
 * Pass — the entry card. Three blocks: a top-anchored run of text, a row of
 * three detail columns, and the QR window the artwork already prints.
 */
function passLayers(source: VariantSource, style: CardStyle, stage: Aspect): Layer[] {
  const rose = style === "rose-emboss";
  const frame = artFrame(stage, source.passArt, LEGACY_PASS_WIDTH);
  const gapPx = rose ? ROSE_PASS.gapPx : BRIDAL_PASS_GAP_PX;
  const textInsetX = rose ? ROSE_PASS.textInsetX : BRIDAL_PASS_TEXT_INSET_X;
  const iconsInsetX = rose ? ROSE_PASS.iconsInsetX : BRIDAL_PASS_ICONS_INSET_X;

  const inkDark = rose ? ROSE_INK_DARK : INK_PRIMARY;
  const inkMid = rose ? ROSE_INK_MID : INK_PRIMARY;
  const inkLight = rose ? ROSE_INK_LIGHT : INK_MUTED;

  const [invitation, names, godWilling] = stack(
    frame,
    [
      { heightPx: PASS_INVITATION.size * PASS_INVITATION.leading, gapBeforePx: 0 },
      { heightPx: PASS_NAMES.size * PASS_NAMES.leading, gapBeforePx: gapPx + PASS_NAMES.marginTop },
      { heightPx: PASS_GOD_WILLING.size * PASS_GOD_WILLING.leading, gapBeforePx: gapPx },
    ],
    source.pass.textTop,
    null,
  );

  const textWidth = 100 - 2 * textInsetX;
  const block = (line: { centre: number; height: number }) =>
    transform({
      x: round2(mapX(frame, 50)),
      y: round2(mapY(frame, line.centre)),
      width: round2(mapW(frame, textWidth)),
      height: round2(mapH(frame, line.height)),
    });

  // `justify-around` over three columns puts their centres at 1/6, 3/6 and 5/6
  // of the row. The row's icons have no builder equivalent, so each column
  // becomes a two-line box — its label over its value — centred on the band
  // the icon+label+value stack occupied.
  const rowWidth = 100 - 2 * iconsInsetX;
  const columnCentreY = source.pass.iconsTop + pxH(frame, PASS_INFO_COLUMN.heightPx) / 2;
  const columnHeight = pxH(frame, PASS_INFO_COLUMN.valueSize * PASS_INFO_COLUMN.valueLeading * 2);
  const columnStyle = textStyle({
    font: "@body",
    fontSize: fontPx(PASS_INFO_COLUMN.valueSize, LEGACY_PASS_WIDTH),
    color: inkMid,
    lineHeight: PASS_INFO_COLUMN.valueLeading,
    letterSpacing: PASS_INFO_COLUMN.tracking,
  });
  const column = (index: number) =>
    transform({
      x: round2(mapX(frame, iconsInsetX + (rowWidth * (index * 2 + 1)) / 6)),
      y: round2(mapY(frame, columnCentreY)),
      width: round2(mapW(frame, rowWidth / 3)),
      height: round2(mapH(frame, columnHeight)),
    });

  return [
    {
      id: L.passCard,
      type: "asset",
      name: "بطاقة الدخول",
      slot: "card",
      fit: "contain",
      scene: "pass",
      z: 0,
      visible: true,
      locked: false,
      base: transform({ x: 50, y: 50, width: 100, height: 100 }),
    },
    {
      id: L.passInvitation,
      type: "text",
      name: "سطر الداعي",
      scene: "pass",
      z: 1,
      visible: true,
      locked: false,
      // The hand-coded pass prints the host line and the verb as ONE wrapped
      // sentence ("تتشرف والدة العريس … بدعوتكم لحضور حفل زفاف") right above
      // the names, so a static template joins the two fields with a space —
      // two content fields would print as two blocks. `invitationText` is
      // now the optional extra text and is usually empty.
      source: "static",
      text: "{hostLine} {inviteVerb}",
      fields: [],
      style: textStyle({
        font: "@body",
        fontSize: fontPx(PASS_INVITATION.size, LEGACY_PASS_WIDTH),
        color: inkLight,
        lineHeight: PASS_INVITATION.leading,
      }),
      tabletStyle: { fontSize: fontPx(PASS_INVITATION.sizeSm, LEGACY_PASS_WIDTH) },
      base: block(invitation),
    },
    {
      id: L.passCouple,
      type: "text",
      name: "أسماء العروسين",
      scene: "pass",
      z: 2,
      visible: true,
      locked: false,
      // A static template, not the `coupleNames` field: that field renders
      // "groom family و bride family", whereas bridal-frame-pass.tsx prints the
      // GROOM first, given names only, joined by "&". Interpolation reproduces
      // it exactly while staying fully dynamic per invitation.
      source: "static",
      text: "{groomFirstName} & {brideFirstName}",
      fields: [],
      style: textStyle({
        font: "@display",
        fontSize: fontPx(PASS_NAMES.size, LEGACY_PASS_WIDTH),
        color: inkDark,
        lineHeight: PASS_NAMES.leading,
      }),
      tabletStyle: { fontSize: fontPx(PASS_NAMES.sizeSm, LEGACY_PASS_WIDTH) },
      base: block(names),
    },
    {
      id: L.passGodWilling,
      type: "text",
      name: "سطر «بمشيئة الله»",
      scene: "pass",
      z: 3,
      visible: true,
      locked: false,
      source: "static",
      text: COPY_GOD_WILLING,
      fields: [],
      style: textStyle({
        font: "@body",
        fontSize: fontPx(PASS_GOD_WILLING.size, LEGACY_PASS_WIDTH),
        color: inkLight,
        lineHeight: PASS_GOD_WILLING.leading,
      }),
      tabletStyle: { fontSize: fontPx(PASS_GOD_WILLING.sizeSm, LEGACY_PASS_WIDTH) },
      base: block(godWilling),
    },
    {
      id: L.passPlace,
      type: "text",
      name: "المكان",
      scene: "pass",
      z: 4,
      visible: true,
      locked: false,
      source: "static",
      text: `${COPY_PLACE}\n{locationFull}`,
      fields: [],
      style: columnStyle,
      base: column(0),
    },
    {
      id: L.passDate,
      type: "text",
      name: "التاريخ",
      scene: "pass",
      z: 5,
      visible: true,
      locked: false,
      source: "static",
      text: `${COPY_DATE}\n{eventDateShort}`,
      fields: [],
      style: columnStyle,
      base: column(1),
    },
    {
      id: L.passTime,
      type: "text",
      name: "الوقت",
      scene: "pass",
      z: 6,
      visible: true,
      locked: false,
      source: "static",
      text: `${COPY_TIME}\n{eventTime}`,
      fields: [],
      style: columnStyle,
      base: column(2),
    },
    {
      id: L.passQr,
      type: "qr",
      name: "الباركود",
      scene: "pass",
      z: 7,
      visible: true,
      locked: false,
      padding: 0,
      borderRadius: 0,
      // The pass art already prints the QR's white window, so the layer adds
      // no plate of its own — a solid one would cover the printed frame.
      background: "#FFFFFF00",
      borderColor: "#FFFFFF00",
      borderWidth: 0,
      fgColor: rose ? ROSE_INK_DARK : qrInk(source.palette.fg),
      base: transform({
        x: round2(mapX(frame, source.pass.qr.left + source.pass.qr.width / 2)),
        y: round2(mapY(frame, source.pass.qr.top + source.pass.qr.height / 2)),
        width: round2(mapW(frame, source.pass.qr.width)),
        height: round2(mapH(frame, source.pass.qr.height)),
      }),
    },
  ];
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * An asset row pointing at a file that is already in the repository.
 *
 * `blobPath` is deliberately NULL. It is the column that tells
 * `removeStoredAsset` which object a row owns, and no row here owns its file:
 * the art is git-tracked under `public/themes/`, the archived LEGACY twin of
 * this very colour still renders from it for the events already using it, and
 * two themes may name the same `assetFolder`. A non-null path would let
 * deleting one asset row — or one variant — delete art out from under
 * everything else still drawing it, and `rm` it from the working tree in dev.
 * The same reasoning already governs `duplicateBuilderTheme`.
 */
function staticAsset(folder: string, slot: string, file: string) {
  const extension = file.split(".").pop() ?? "jpg";
  return {
    slot,
    url: `/themes/${folder}/${file}`,
    blobPath: null,
    mimeType: MIME_BY_EXTENSION[extension] ?? "image/jpeg",
  };
}

function assetsFor(source: VariantSource, style: CardStyle) {
  const rose = style === "rose-emboss";
  return [
    staticAsset(source.folder, "background", "background.jpg"),
    staticAsset(source.folder, "envelopeClosed", rose ? "envelope-closed.jpg" : "envelope-closed.webp"),
    staticAsset(source.folder, "envelopeOpen", "envelope-open.webp"),
    staticAsset(source.folder, "card", "pass-card.jpg"),
    ...(rose ? [staticAsset(source.folder, "seal", "seal.png")] : []),
  ];
}

// ---------------------------------------------------------------------------
// Reading the family
// ---------------------------------------------------------------------------

const familySelect = {
  id: true,
  slug: true,
  name: true,
  nameAr: true,
  status: true,
  engine: true,
  config: true,
} satisfies Prisma.ThemeSelect;

/**
 * The colour siblings of a legacy design: separate `Theme` rows sharing
 * `config.family`. Already-archived ones are skipped — a retired colour has no
 * place in a fresh design, and leaving it alone keeps the revert unambiguous.
 *
 * The family match runs in JS rather than as a Json path filter: there are 75
 * legacy rows in total, and both halves of the test (`family` and a `card`
 * block) then read the same way as everywhere else in this file.
 */
async function findFamilySiblings(theme: { id: string; config: unknown }) {
  const family = (theme.config as unknown as ThemeConfig).family;
  if (!family) return [];

  const rows = await prisma.theme.findMany({
    where: {
      id: { not: theme.id },
      engine: ThemeEngine.LEGACY,
      // PUBLISHED only: a ThemeVariant carries no status, so merging a DRAFT or
      // HIDDEN colour would silently publish it.
      status: ThemeStatus.PUBLISHED,
    },
    select: familySelect,
    orderBy: { createdAt: "asc" },
  });

  return rows.filter((row) => {
    const config = row.config as unknown as ThemeConfig;
    return config.family === family && Boolean(config.card?.style);
  });
}

export interface LegacyArtworkStatus {
  style: CardStyle;
  /** The row already runs on the builder engine and can be put back. */
  converted: boolean;
  /**
   * Colours the conversion would merge, or — once converted — the colours it
   * did merge. Always at least 1: the theme's own.
   */
  colorCount: number;
}

/**
 * What the convert/revert control needs to know before anything is written:
 * whether this theme has artwork to import at all, and how many colours are on
 * the table. Returns null for the 48 config-only legacy themes, which the old
 * editor already covers completely.
 */
export async function legacyArtworkStatus(themeId: string): Promise<LegacyArtworkStatus | null> {
  const theme = await prisma.theme.findUnique({
    where: { id: themeId },
    select: { ...familySelect, _count: { select: { variants: true } } },
  });
  if (!theme) return null;
  const style = (theme.config as unknown as ThemeConfig).card?.style;
  if (!style) return null;

  if (theme.engine === ThemeEngine.BUILDER) {
    return { style, converted: true, colorCount: Math.max(1, theme._count.variants) };
  }

  const siblings = await findFamilySiblings(theme);
  return { style, converted: false, colorCount: siblings.length + 1 };
}

// ---------------------------------------------------------------------------
// The import
// ---------------------------------------------------------------------------

export interface ImportLegacyOptions {
  /** Fold the design's other colours in as variants. On by default. */
  mergeFamily?: boolean;
}

export async function importLegacyTheme(
  actorId: string,
  themeId: string,
  options: ImportLegacyOptions = {},
) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId }, select: familySelect });
  if (!theme) throw new ThemeAdminError("التصميم غير موجود");
  if (theme.engine !== ThemeEngine.LEGACY) {
    throw new ThemeAdminError("هذا التصميم محوّل للمحرر المرئي أصلاً");
  }

  const config = theme.config as unknown as ThemeConfig;
  const style = config.card?.style;
  if (!style) {
    throw new ThemeAdminError("هذا التصميم ما فيه رسومات بطاقة — ما فيه شيء يتحوّل");
  }

  const existingBuilderRows = await prisma.themeVariant.count({ where: { themeId } });
  if (existingBuilderRows > 0) {
    throw new ThemeAdminError("التصميم فيه ألوان محرر سابقة — احذفها قبل إعادة التحويل");
  }

  const merge = options.mergeFamily ?? true;
  const siblings = merge ? await findFamilySiblings(theme) : [];
  const sources = [theme, ...siblings].map(readVariantSource);
  const [base, ...rest] = sources;

  // One canvas per scene, sized to the TALLEST art in the family — see
  // `artFrame` for why that is the ratio that keeps every colour honest.
  const tallest = (pick: (s: VariantSource) => Aspect): Aspect =>
    sources.reduce((best, s) => (pick(s).w / pick(s).h < best.w / best.h ? pick(s) : best), pick(base));
  const scenes: Scenes = {
    cover: tallest((s) => s.closed),
    open: tallest((s) => s.openArt),
    pass: tallest((s) => s.passArt),
  };
  const canvas = (a: Aspect): SceneCanvas => ({ aspectW: a.w, aspectH: a.h, safeInset: 6 });

  const baseLayers = buildLayers(base, style, scenes);
  const layoutDoc: LayoutDoc = assertLayoutDoc({
    version: BUILDER_SCHEMA_VERSION,
    // The legacy `RoseCandlelightBackground` is a fixed, full-bleed photo behind
    // every scene — which is exactly what `page` is, so it is not a layer.
    page: { slot: "background", fit: "cover", overlayColor: "#000000", overlayOpacity: 0 },
    // Scenes are an ordered list, not the old fixed trio. The three ids stay
    // exactly `cover`/`open`/`pass` because every layer built above points at
    // them by name.
    scenes: [
      { id: "cover", name: "الظرف المغلق", role: "cover", canvas: canvas(scenes.cover), visible: true, requires: null },
      { id: "open", name: "الظرف المفتوح", role: "flow", canvas: canvas(scenes.open), visible: true, requires: null },
      ...FLOW_SCENE_TEMPLATES,
      { id: "pass", name: "بطاقة الدخول", role: "pass", canvas: canvas(scenes.pass), visible: true, requires: null },
    ],
    // The converted art covers the cover/open/pass screens; the rest of the
    // flow is the same default set every other theme gets, so a converted
    // theme keeps the greeting, countdown, details, schedule, notes and RSVP
    // screens the hand-coded renderer used to draw for it.
    layers: [...baseLayers, ...defaultFlowLayers()],
    animation: DEFAULT_ANIMATION,
  });

  const typographyDoc: TypographyDoc = assertTypographyDoc({
    version: BUILDER_SCHEMA_VERSION,
    roles: {
      display: { family: config.fonts.arabicDisplay, weight: 400 },
      body: { family: config.fonts.arabicBody, weight: 400 },
      latin: { family: config.fonts.latinDisplay, weight: 500 },
    },
  });

  /**
   * A sibling's art and hotspots are its own, so its layers are rebuilt from
   * its own numbers and stored as the sparse per-layer overrides the renderer
   * already applies on top of the shared document.
   */
  const overridesFor = (source: VariantSource): Prisma.InputJsonValue | undefined => {
    const layers = buildLayers(source, style, scenes);
    const overrides: Record<string, TransformOverride> = {};
    layers.forEach((layer, index) => {
      const baseTransform = baseLayers[index].base;
      const diff: TransformOverride = {};
      if (layer.base.x !== baseTransform.x) diff.x = layer.base.x;
      if (layer.base.y !== baseTransform.y) diff.y = layer.base.y;
      if (layer.base.width !== baseTransform.width) diff.width = layer.base.width;
      if (layer.base.height !== baseTransform.height) diff.height = layer.base.height;
      // Per-layer type sizes are document-level, but the monogram's size is
      // per-variant in the legacy config — `scale` carries it across, and the
      // seal box is centred on its anchor so it scales about the right point.
      if (layer.id === L.coverMonogram && source.sealFontPx !== base.sealFontPx) {
        diff.scale = round2(source.sealFontPx / base.sealFontPx);
      }
      if (Object.keys(diff).length > 0) overrides[layer.id] = diff;
    });
    return Object.keys(overrides).length > 0 ? json(overrides) : undefined;
  };

  await prisma.$transaction(async (tx) => {
    await tx.themeLayout.upsert({
      where: { themeId },
      create: { themeId, doc: json(layoutDoc) },
      update: { doc: json(layoutDoc) },
    });
    await tx.themeTypography.upsert({
      where: { themeId },
      create: { themeId, doc: json(typographyDoc) },
      update: { doc: json(typographyDoc) },
    });

    for (const [index, source] of sources.entries()) {
      const variant = await tx.themeVariant.create({
        data: {
          themeId,
          slug: source.slug,
          name: source.name,
          nameAr: source.nameAr,
          colorTag: source.colorTag,
          palette: json(source.palette),
          layoutOverrides: index === 0 ? undefined : overridesFor(source),
          sortOrder: index,
          isDefault: index === 0,
        },
      });

      for (const asset of assetsFor(source, style)) {
        await tx.themeAsset.create({ data: { themeId, variantId: variant.id, ...asset } });
      }
    }

    // ARCHIVED, never deleted: events already point at these rows, and an
    // archived LEGACY row keeps its config and keeps rendering exactly as it
    // does today — it just stops showing up as a second gallery card.
    if (rest.length > 0) {
      await tx.theme.updateMany({
        where: { id: { in: rest.map((s) => s.themeId) } },
        data: { status: ThemeStatus.ARCHIVED, archivedAt: new Date() },
      });
    }

    await tx.theme.update({
      where: { id: themeId },
      // `config` is untouched on purpose — it is what makes this reversible.
      data: { engine: ThemeEngine.BUILDER, updatedById: actorId },
    });
  });

  return { colorCount: sources.length, archived: rest.length };
}

// ---------------------------------------------------------------------------
// The way back
// ---------------------------------------------------------------------------

/**
 * Undo an import: flip `engine` back and drop everything the import created.
 *
 * Safe because the import never wrote to `Theme.config` — the hand-coded
 * renderers read that same object again and draw exactly what they drew
 * before. The check below is not decoration: reverting a row whose config has
 * lost its `card` block would leave a theme neither engine can render.
 *
 * Merged colours come back as PUBLISHED rows. The import only ever archives
 * colours that were not archived already, and there is nowhere to record which
 * status each one held; publishing is the status all of them are in practice.
 * `restoreColors: false` leaves them archived instead, for the admin who wants
 * to bring the design back one colour at a time.
 */
export async function revertLegacyImport(
  actorId: string,
  themeId: string,
  options: { restoreColors?: boolean } = {},
) {
  const theme = await prisma.theme.findUnique({
    where: { id: themeId },
    select: { id: true, engine: true, config: true, variants: { select: { slug: true } } },
  });
  if (!theme) throw new ThemeAdminError("التصميم غير موجود");
  if (theme.engine !== ThemeEngine.BUILDER) {
    throw new ThemeAdminError("هذا التصميم على النظام القديم أصلاً");
  }
  if (!(theme.config as unknown as ThemeConfig).card?.style) {
    throw new ThemeAdminError("هذا التصميم ما جاء من تحويل — ما فيه إعدادات قديمة يرجع لها");
  }

  const restoreColors = options.restoreColors ?? true;
  const siblingSlugs = theme.variants.map((variant) => variant.slug);
  // Art an admin uploaded onto a colour AFTER the import does own its objects,
  // so those are collected before the rows go and cleaned up once the flip has
  // stuck. Everything the import itself created has a null blobPath and leaves
  // its shared file alone.
  const uploaded = await prisma.themeAsset.findMany({
    where: { themeId, variantId: { not: null }, blobPath: { not: null } },
    select: { blobPath: true },
  });

  await prisma.$transaction(async (tx) => {
    // Every row the import created hangs off a variant, so the cascade takes
    // them; the scoped sweep is only for a row whose variant already went. It
    // must stay scoped: a theme-wide asset row (variantId null) can predate the
    // import — that is what the old asset manager writes — and deleting those
    // would take an image off a theme this function is supposed to restore.
    await tx.themeVariant.deleteMany({ where: { themeId } });
    await tx.themeAsset.deleteMany({ where: { themeId, variantId: { not: null } } });
    await tx.themeLayout.deleteMany({ where: { themeId } });
    await tx.themeTypography.deleteMany({ where: { themeId } });

    if (restoreColors && siblingSlugs.length > 0) {
      await tx.theme.updateMany({
        where: {
          slug: { in: siblingSlugs },
          id: { not: themeId },
          engine: ThemeEngine.LEGACY,
          status: ThemeStatus.ARCHIVED,
        },
        data: { status: ThemeStatus.PUBLISHED, archivedAt: null },
      });
    }

    await tx.theme.update({
      where: { id: themeId },
      data: { engine: ThemeEngine.LEGACY, updatedById: actorId },
    });
  });

  for (const asset of uploaded) await removeStoredAsset(asset.blobPath);

  return { restored: restoreColors ? siblingSlugs.length : 0 };
}
