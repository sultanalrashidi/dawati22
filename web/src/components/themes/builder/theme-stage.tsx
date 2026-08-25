import type { CSSProperties, PointerEventHandler, ReactNode, Ref } from "react";
import { fontStackFor } from "@/lib/themes/font-registry";
import { slotLabelAr } from "@/lib/themes/builder/slots";
import { initialsFor, interpolate, type ResolvedContent } from "@/lib/themes/builder/content";
import { resolveScene, type LayoutOverrides, type ResolvedLayer } from "@/lib/themes/builder/resolve";
import {
  resolveFont,
  resolveTextStyle,
  type Breakpoint,
  type LayoutDoc,
  type QrLayer,
  type SceneId,
  type SealLayer,
  type TextLayer,
  type TextStyle,
  type Transform,
  type TypographyDoc,
  type VariantPalette,
} from "@/lib/themes/builder/types";

/**
 * The one renderer for builder themes.
 *
 * Geometry lives in percentages of the stage, and type is sized in `cqw`
 * against the stage's own width — so a layout authored once on a 390px phone
 * frame is proportionally identical at 1280px with no media queries and no
 * per-device maths. The editor mounts this exact component under its drag
 * handles, which is why "live preview" needs no second implementation.
 */

/** Text sizes in the document are authored against a stage this wide. */
const REFERENCE_STAGE_WIDTH = 390;

/** px at the reference width → cqw, so it scales with the stage. */
function scaled(px: number): string {
  return `${(px / REFERENCE_STAGE_WIDTH) * 100}cqw`;
}

export interface ThemeStageProps {
  scene: SceneId;
  layout: LayoutDoc;
  typography: TypographyDoc;
  palette: VariantPalette;
  /** slot → image url */
  assets: Record<string, string>;
  content: ResolvedContent;
  breakpoint: Breakpoint;
  overrides?: LayoutOverrides;
  /** The guest's real QR. Omitted in the editor, which draws a sample. */
  qrDataUrl?: string | null;
  /** Editor-only chrome drawn on top of each layer. */
  renderLayerOverlay?: (resolved: ResolvedLayer) => ReactNode;
  /** Editor-only guides. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** The editor needs the stage element to convert pointer pixels to percent. */
  ref?: Ref<HTMLDivElement>;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
}

export function ThemeStage({
  scene,
  layout,
  typography,
  palette,
  assets,
  content,
  breakpoint,
  overrides,
  qrDataUrl,
  renderLayerOverlay,
  children,
  className,
  style,
  ref,
  onPointerDown,
}: ThemeStageProps) {
  const canvas = layout.scenes[scene];
  const resolved = resolveScene(layout, scene, breakpoint, overrides);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{
        aspectRatio: `${canvas.aspectW} / ${canvas.aspectH}`,
        containerType: "inline-size",
        backgroundColor: palette.bg,
        color: palette.fg,
        ...style,
      }}
    >
      {resolved.map((entry) => (
        <LayerBox key={entry.layer.id} resolved={entry}>
          <LayerContent
            resolved={entry}
            assets={assets}
            content={content}
            typography={typography}
            palette={palette}
            breakpoint={breakpoint}
            qrDataUrl={qrDataUrl}
          />
          {renderLayerOverlay?.(entry)}
        </LayerBox>
      ))}
      {children}
    </div>
  );
}

/** Positioning shell — identical for every layer type. */
function LayerBox({ resolved, children }: { resolved: ResolvedLayer; children: ReactNode }) {
  return (
    <div
      data-layer-id={resolved.layer.id}
      style={boxStyle(resolved.transform)}
    >
      {children}
    </div>
  );
}

export function boxStyle(transform: Transform): CSSProperties {
  return {
    position: "absolute",
    left: `${transform.x}%`,
    top: `${transform.y}%`,
    width: `${transform.width}%`,
    height: transform.height === null ? "auto" : `${transform.height}%`,
    // Centre anchor keeps drag maths and the numeric fields honest: x/y is
    // always the element's middle, never a corner that shifts as it resizes.
    transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.scale})`,
    opacity: transform.opacity,
  };
}

function LayerContent({
  resolved,
  assets,
  content,
  typography,
  palette,
  breakpoint,
  qrDataUrl,
}: {
  resolved: ResolvedLayer;
  assets: Record<string, string>;
  content: ResolvedContent;
  typography: TypographyDoc;
  palette: VariantPalette;
  breakpoint: Breakpoint;
  qrDataUrl?: string | null;
}) {
  const { layer, transform } = resolved;

  switch (layer.type) {
    case "asset": {
      const url = assets[layer.slot];
      if (!url) return <MissingAsset slot={layer.slot} />;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          draggable={false}
          className="block h-full w-full select-none"
          style={{ objectFit: layer.fit }}
        />
      );
    }
    case "text":
      return <TextContent layer={layer} content={content} typography={typography} breakpoint={breakpoint} />;
    case "seal":
      return <SealContent layer={layer} content={content} typography={typography} breakpoint={breakpoint} />;
    case "qr":
      return <QrContent layer={layer} qrDataUrl={qrDataUrl} palette={palette} transform={transform} />;
  }
}

function textStyleToCss(style: TextStyle, typography: TypographyDoc): CSSProperties {
  const role = resolveFont(style.font, typography);
  return {
    fontFamily: fontStackFor(role.family),
    fontSize: scaled(style.fontSize),
    fontWeight: style.fontWeight,
    color: style.color,
    textAlign: style.align,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacing}em`,
  };
}

function TextContent({
  layer,
  content,
  typography,
  breakpoint,
}: {
  layer: TextLayer;
  content: ResolvedContent;
  typography: TypographyDoc;
  breakpoint: Breakpoint;
}) {
  const style = resolveTextStyle(layer, breakpoint);
  const lines =
    layer.source === "content"
      ? layer.fields.map((field) => content[field]).filter((value) => value.length > 0)
      : interpolate(layer.text, content).split("\n");

  const justify = style.align === "start" ? "flex-start" : style.align === "end" ? "flex-end" : "center";

  return (
    <div
      dir="rtl"
      className="flex h-full w-full flex-col"
      style={{ ...textStyleToCss(style, typography), justifyContent: justify }}
    >
      {lines.map((line, index) => (
        <span key={index} className="block whitespace-pre-wrap break-words">
          {line}
        </span>
      ))}
    </div>
  );
}

function SealContent({
  layer,
  content,
  typography,
  breakpoint,
}: {
  layer: SealLayer;
  content: ResolvedContent;
  typography: TypographyDoc;
  breakpoint: Breakpoint;
}) {
  const style = resolveTextStyle(layer, breakpoint);
  const text =
    layer.mode === "initials"
      ? initialsFor(content, layer.separator, layer.maxChars, layer.script, layer.order)
      : layer.text;

  return (
    <div
      dir={layer.script === "arabic" ? "rtl" : "ltr"}
      className="flex h-full w-full items-center justify-center text-center leading-none"
      style={textStyleToCss(style, typography)}
    >
      <span className="whitespace-nowrap">{text}</span>
    </div>
  );
}

function QrContent({
  layer,
  qrDataUrl,
  palette,
  transform,
}: {
  layer: QrLayer;
  qrDataUrl?: string | null;
  palette: VariantPalette;
  transform: Transform;
}) {
  // Padding is a share of the layer's own width; the layer's width is a share
  // of the stage, so one multiplication keeps it in stage-relative cqw.
  const paddingCqw = `${(layer.padding / 100) * transform.width}cqw`;

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        backgroundColor: layer.background,
        borderRadius: scaled(layer.borderRadius),
        border: layer.borderWidth > 0 ? `${scaled(layer.borderWidth)} solid ${layer.borderColor}` : undefined,
        padding: paddingCqw,
      }}
    >
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt="" className="block h-full w-full object-contain" />
      ) : (
        <SampleQr fg={layer.fgColor || palette.fg} />
      )}
    </div>
  );
}

/**
 * A stand-in that reads as a QR at a glance while designing — real finder
 * squares in three corners, deterministic data modules so the preview does not
 * shimmer on every re-render.
 */
export function SampleQr({ fg }: { fg: string }) {
  const size = 21;
  const cells: boolean[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      cells.push(sampleCell(row, col, size));
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="block h-full w-full" shapeRendering="crispEdges" aria-hidden="true">
      {cells.map((on, index) =>
        on ? (
          <rect key={index} x={index % size} y={Math.floor(index / size)} width={1} height={1} fill={fg} />
        ) : null,
      )}
    </svg>
  );
}

function sampleCell(row: number, col: number, size: number): boolean {
  const finder = finderValue(row, col, size);
  if (finder !== null) return finder;
  // Cheap deterministic hash — stable across renders, visually noisy enough.
  return ((row * 31 + col * 17 + ((row * col) % 7)) & 3) > 1;
}

/** The three 7×7 alignment squares a scanner looks for. */
function finderValue(row: number, col: number, size: number): boolean | null {
  const corners = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  for (const [top, left] of corners) {
    const r = row - top;
    const c = col - left;
    if (r >= 0 && r < 7 && c >= 0 && c < 7) {
      const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      return ring === 1 ? false : ring <= 3;
    }
  }
  return null;
}

/**
 * Placeholder for a slot with no image yet.
 *
 * `aspectRatio` matters: an asset layer usually has `height: null` so it can
 * take its height from the image, and with no image the box would collapse to
 * nothing — leaving a layer that cannot be seen, selected or dragged. A new
 * theme starts with exactly that state for every slot, so the placeholder has
 * to hold a real box until the art arrives.
 */
function MissingAsset({ slot }: { slot: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded border border-dashed border-current/30 bg-current/5"
      style={{ aspectRatio: "3 / 2" }}
    >
      <span className="px-1 text-center text-[2.5cqw] opacity-50">{slotLabelAr(slot)}</span>
    </div>
  );
}
