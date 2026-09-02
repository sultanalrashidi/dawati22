import Image from "next/image";
import type { CSSProperties, PointerEventHandler, ReactNode, Ref } from "react";
import type { ScheduleItem } from "@/lib/events/types";
import { slotLabelAr } from "@/lib/themes/builder/slots";
import { initialsFor, interpolate, isCoupleField, type ResolvedContent } from "@/lib/themes/builder/content";
import { resolveScene, type LayoutOverrides, type ResolvedLayer } from "@/lib/themes/builder/resolve";
import {
  resolveTextStyle,
  sceneCanvas,
  type Breakpoint,
  type ContentField,
  type LayoutDoc,
  type QrLayer,
  type SceneCanvas,
  type SceneId,
  type SealLayer,
  type TextLayer,
  type Transform,
  type TypographyDoc,
  type VariantPalette,
} from "@/lib/themes/builder/types";
import { justifyFor, scaled, textStyleToCss } from "./layers/style";
import { CountdownContent } from "./layers/countdown-layer";
import { ButtonContent } from "./layers/button-layer";
import { NotesContent } from "./layers/notes-layer";
import { ScheduleContent } from "./layers/schedule-layer";
import { RsvpContent, type StageRsvp } from "./layers/rsvp-layer";

/**
 * The one renderer for builder themes.
 *
 * Geometry lives in percentages of the stage, and type is sized in `cqw`
 * against the stage's own width — so a layout authored once on a 390px phone
 * frame is proportionally identical at 1280px with no media queries and no
 * per-device maths. The editor mounts this exact component under its drag
 * handles, which is why "live preview" needs no second implementation.
 *
 * It stays a pure function of its props. Four of the nine layer types print
 * live invitation data — the countdown needs the event's date, the buttons its
 * map link, the schedule and notes their rows, the RSVP block the guest it is
 * booking for — and every one of those arrives here as an optional prop rather
 * than being fetched. The guest page passes the real values; the editor passes
 * none and each layer falls back to a sample, so an admin arranges the design
 * against something plausible instead of empty boxes.
 */

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
  /**
   * False when the event was sold without a scannable entry pass: the scene's
   * `qr` layers are then dropped entirely. In this engine the layer owns its
   * own frame, so removing it leaves nothing behind — unlike the legacy art
   * passes, whose frame is printed into the card image and must be filled.
   */
  hasQr?: boolean;
  /**
   * The moment a `countdown` layer counts to. Omitted in the editor, which
   * counts to the sample invitation's date so the digits look plausible.
   */
  eventDateIso?: string;
  /**
   * The invitation's own token. A `calendar` button links to
   * `/i/{linkToken}/calendar` with it, and the RSVP block falls back to
   * submitting against it directly when no `onRsvp` is wired; without one both
   * fall back to their inert preview behaviour.
   */
  linkToken?: string | null;
  /** Destination for a `map` button. Missing → the button renders disabled. */
  mapUrl?: string | null;
  /** Handler for a `music` button. Missing → the button renders disabled. */
  onToggleMusic?: (() => void) | null;
  /** Drives a `music` button's pressed state. */
  musicPlaying?: boolean;
  /**
   * Rows for a `schedule` layer. `undefined` is "no event attached" (the
   * editor) and shows samples; `null`/`[]` is "this event has no schedule" and
   * shows nothing — a guest must never read invented times.
   */
  scheduleItems?: ScheduleItem[] | null;
  /** The organiser's notes for a `notes` layer, newline-separated. Same split. */
  notesAr?: string | null;
  /**
   * The guest an `rsvp` layer is booking for, plus this page's RSVP copy.
   * Omitted → a working-looking form that simulates instead of submitting.
   */
  rsvp?: StageRsvp | null;
  /**
   * True inside the admin canvas. It changes three things a guest must not see:
   * every layer accepts pointer events so it can be selected and dragged, a
   * `qr` layer draws the sample code, and interactive layers stay inert.
   */
  editing?: boolean;
  /**
   * The guest already answered, so an `rsvp` layer shows its thank-you state
   * instead of the form — in place, without removing the screen it sits on.
   */
  rsvpResponded?: "ACCEPTED" | "DECLINED" | null;
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
  hasQr = true,
  eventDateIso,
  linkToken,
  mapUrl,
  onToggleMusic,
  musicPlaying,
  scheduleItems,
  notesAr,
  rsvp,
  editing = false,
  rsvpResponded = null,
  renderLayerOverlay,
  children,
  className,
  style,
  ref,
  onPointerDown,
}: ThemeStageProps) {
  const canvas = sceneCanvas(layout, scene);
  const resolved = resolveScene(layout, scene, breakpoint, overrides, palette);

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
      {resolved
        // A `qr` layer in the builder engine IS its own frame — background,
        // border and padding are the layer's. Dropping it for an event with no
        // scannable pass removes the frame with it, and the pass scene keeps
        // its own name/date/venue layers, so nothing is left looking broken.
        //
        // The legacy art passes do the OPPOSITE (see PassholderTag): their
        // frame is printed into pass-card.jpg and cannot be removed, so there
        // the box has to be filled instead. Do not unify these two — they are
        // different because the artwork is different.
        .filter((entry) => hasQr || entry.layer.type !== "qr")
        .map((entry) => (
        <LayerBox key={entry.layer.id} resolved={entry} editing={editing}>
          <LayerContent
            resolved={entry}
            canvas={canvas}
            assets={assets}
            content={content}
            typography={typography}
            palette={palette}
            breakpoint={breakpoint}
            qrDataUrl={qrDataUrl}
            hasQr={hasQr}
            eventDateIso={eventDateIso}
            linkToken={linkToken}
            mapUrl={mapUrl}
            onToggleMusic={onToggleMusic}
            musicPlaying={musicPlaying}
            scheduleItems={scheduleItems}
            notesAr={notesAr}
            rsvp={rsvp}
            editing={editing}
            rsvpResponded={rsvpResponded}
          />
          {renderLayerOverlay?.(entry)}
        </LayerBox>
      ))}
      {children}
    </div>
  );
}

/** Layer types a guest is meant to touch. Everything else is decoration. */
const INTERACTIVE_LAYERS = new Set(["rsvp", "button"]);

/**
 * Positioning shell — identical for every layer type.
 *
 * Decorative layers are `pointer-events: none` for guests. Layers are absolute
 * siblings painted in `z` order, so without this a photo or a text box sitting
 * above the RSVP block would silently swallow every tap on the form and the
 * guest would have no way to book. In the editor every box stays clickable,
 * because that is how a layer gets selected and dragged.
 */
function LayerBox({
  resolved,
  editing,
  children,
}: {
  resolved: ResolvedLayer;
  editing: boolean;
  children: ReactNode;
}) {
  const interactive = editing || INTERACTIVE_LAYERS.has(resolved.layer.type);
  return (
    <div
      data-layer-id={resolved.layer.id}
      style={{ ...boxStyle(resolved.transform), pointerEvents: interactive ? "auto" : "none" }}
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
  canvas,
  assets,
  content,
  typography,
  palette,
  breakpoint,
  qrDataUrl,
  hasQr = true,
  eventDateIso,
  linkToken,
  mapUrl,
  onToggleMusic,
  musicPlaying,
  scheduleItems,
  notesAr,
  rsvp,
  editing,
  rsvpResponded,
}: {
  resolved: ResolvedLayer;
  canvas: SceneCanvas;
  assets: Record<string, string>;
  content: ResolvedContent;
  typography: TypographyDoc;
  palette: VariantPalette;
  breakpoint: Breakpoint;
  qrDataUrl?: string | null;
  /** False for an event sold without a scannable pass — see the "asset" case. */
  hasQr?: boolean;
  eventDateIso?: string;
  linkToken?: string | null;
  mapUrl?: string | null;
  onToggleMusic?: (() => void) | null;
  musicPlaying?: boolean;
  scheduleItems?: ScheduleItem[] | null;
  notesAr?: string | null;
  rsvp?: StageRsvp | null;
  editing: boolean;
  rsvpResponded: "ACCEPTED" | "DECLINED" | null;
}) {
  const { layer, transform } = resolved;

  switch (layer.type) {
    case "asset": {
      // "card" is the pass scene's background art (see slots.ts). An admin can
      // upload a second image under "cardNoQr" — a card designed without a
      // code window — and a NO_QR event's pass then uses that instead. Nothing
      // else changes: every other asset slot renders exactly as before.
      const noQrCard = !hasQr && layer.slot === "card" ? assets.cardNoQr : undefined;
      const url = noQrCard ?? assets[layer.slot];
      if (!url) return <MissingAsset slot={layer.slot} />;
      // In the editor the admin is judging the artwork itself, so it is served
      // exactly as uploaded — untouched, unresized, un-re-encoded. A guest gets
      // it cut to their own screen instead, which is the difference between a
      // phone downloading a 200 KB photograph and a 25 KB one.
      if (editing) {
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
      return (
        <Image
          src={url}
          alt=""
          draggable={false}
          // The box is sized by the layer, never by the file: its width is a
          // percentage of the stage and its height is either a percentage too
          // or follows the artwork's own proportions. So these two are only a
          // shape to hold while the image is in flight — nothing lays out from
          // them, and nothing here reads an intrinsic size.
          width={1600}
          height={1600}
          // The layer's own share of the stage, and the stage is never wider
          // than the screen — so this is an upper bound on every device, and
          // an exact one on the phones that matter. An admin can upload art of
          // any proportions, which is why it is expressed as the box's width
          // rather than guessed from the file.
          sizes={`${Math.min(100, Math.ceil(transform.width))}vw`}
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
      return (
        <QrContent
          layer={layer}
          qrDataUrl={qrDataUrl}
          palette={palette}
          transform={transform}
          editing={editing}
        />
      );
    case "countdown":
      return <CountdownContent layer={layer} typography={typography} eventDateIso={eventDateIso} />;
    case "button":
      return (
        <ButtonContent
          layer={layer}
          typography={typography}
          // In the editor a button has nowhere to go on purpose: clicking a
          // layer there means "select and drag me", and a live link would
          // navigate the admin's browser away mid-edit.
          linkToken={editing ? null : linkToken}
          mapUrl={editing ? null : mapUrl}
          musicPlaying={musicPlaying}
          onToggleMusic={editing ? null : onToggleMusic}
          editing={editing}
        />
      );
    case "rsvp":
      return (
        <RsvpContent
          layer={layer}
          typography={typography}
          palette={palette}
          linkToken={linkToken}
          rsvp={rsvp}
          defaultGuestName={content.guestName}
          alreadyAnswered={rsvpResponded}
        />
      );
    case "schedule":
      return (
        <ScheduleContent
          layer={layer}
          typography={typography}
          transform={transform}
          canvas={canvas}
          scheduleItems={scheduleItems}
        />
      );
    case "notes":
      return <NotesContent layer={layer} typography={typography} notesAr={notesAr} />;
  }
}

/**
 * The lines a `content`-sourced text layer prints.
 *
 * Couple-scoped fields repeat per couple, so a layer set to "groom & bride"
 * lists a joint wedding in full instead of naming the first pair only. Fields
 * shared by the whole invitation print once, in the order the admin chose.
 */
function contentLines(fields: ContentField[], content: ResolvedContent): string[] {
  const coupleScoped = fields.filter(isCoupleField);
  if (content.perCouple.length > 1 && coupleScoped.length > 0) {
    return fields
      .flatMap((field) =>
        isCoupleField(field)
          ? content.perCouple.map((couple) => couple[field])
          : [content[field]],
      )
      .filter((value) => value.length > 0);
  }
  return fields.map((field) => content[field]).filter((value) => value.length > 0);
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
      ? contentLines(layer.fields, content)
      : interpolate(layer.text, content).split("\n");

  return (
    <div
      dir="rtl"
      className="flex h-full w-full flex-col"
      style={{ ...textStyleToCss(style, typography), justifyContent: justifyFor(style.align) }}
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
  editing,
}: {
  layer: QrLayer;
  qrDataUrl?: string | null;
  palette: VariantPalette;
  transform: Transform;
  editing: boolean;
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
      {/*
        The sample pattern is EDITOR ONLY. It is deliberately convincing, so
        showing it to a guest who has no real code yet would hand them
        something that looks like a working entry pass and fails at the door.
        With no code and no editor, the box simply stays empty.

        An event sold without a code never reaches here at all — ThemeStage
        drops its `qr` layers. See the note there for why that is the right move
        for the builder engine and the wrong one for the legacy art passes.
      */}
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt="" className="block h-full w-full object-contain" />
      ) : editing ? (
        <SampleQr fg={layer.fgColor || palette.fg} />
      ) : null}
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
