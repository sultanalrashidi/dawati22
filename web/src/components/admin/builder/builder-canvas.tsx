"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeStage, boxStyle } from "@/components/themes/builder/theme-stage";
import { findScene, resolveTransform, sceneCanvas, type Breakpoint, type Layer, type LayoutDoc, type SceneCanvas, type SceneId, type SceneRole, type Transform, type TransformOverride, type TypographyDoc, type VariantPalette } from "@/lib/themes/builder/types";
import type { ResolvedContent } from "@/lib/themes/builder/content";

/**
 * The editing surface: the real renderer with a manipulation layer on top.
 *
 * All geometry maths runs in pixels and converts back to stage percentages at
 * the end. That matters because `x`/`width` are percentages of the stage width
 * while `y`/`height` are percentages of its height — mixing those two scales in
 * a rotation would skew every rotated resize.
 */

/**
 * The guest caps each stage with
 * `min(26rem, calc((100dvh - reserve) * aspectW / aspectH))` and centres it in
 * the viewport, letting the page background show through around it. Mirroring
 * that arithmetic here is what makes the editor preview the same crop the guest
 * gets — a stage stretched to the full frame width would sit against a
 * different part of a `cover` background entirely.
 */
/**
 * Keyed by ROLE, not by scene id: scenes are user-defined now, so a theme can
 * carry a screen called `s_9f3a1c02` that the old id-keyed map knew nothing
 * about and reserved `undefined` pixels for. The three built-in scenes keep
 * exactly the numbers they had — cover/open/pass are the cover/flow/pass roles.
 */
const ROLE_RESERVE_PX: Record<SceneRole, number> = { cover: 144, flow: 160, pass: 192 };
const STAGE_MAX_PX = 416; // 26rem

function guestStageWidth(
  canvas: { aspectW: number; aspectH: number },
  role: SceneRole,
  frameW: number,
  frameH: number,
) {
  const byHeight = ((frameH - ROLE_RESERVE_PX[role]) * canvas.aspectW) / canvas.aspectH;
  return Math.max(80, Math.min(frameW, STAGE_MAX_PX, byHeight));
}

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: { id: HandleId; sx: -1 | 0 | 1; sy: -1 | 0 | 1; cursor: string }[] = [
  { id: "nw", sx: -1, sy: -1, cursor: "nwse-resize" },
  { id: "n", sx: 0, sy: -1, cursor: "ns-resize" },
  { id: "ne", sx: 1, sy: -1, cursor: "nesw-resize" },
  { id: "e", sx: 1, sy: 0, cursor: "ew-resize" },
  { id: "se", sx: 1, sy: 1, cursor: "nwse-resize" },
  { id: "s", sx: 0, sy: 1, cursor: "ns-resize" },
  { id: "sw", sx: -1, sy: 1, cursor: "nesw-resize" },
  { id: "w", sx: -1, sy: 0, cursor: "ew-resize" },
];

interface Gesture {
  kind: "move" | "resize" | "rotate";
  /**
   * The layer this gesture owns. Deliberately not read from the `selectedId`
   * prop: pointer-down selects and starts dragging in the same tick, and the
   * prop only reflects the new selection a render later — reading it would
   * drag whatever was selected before.
   */
  layerId: string;
  handle?: HandleId;
  startClientX: number;
  startClientY: number;
  start: Transform;
  /** Rendered pixel height, needed when `height` is null (auto). */
  startHeightPx: number;
  stageW: number;
  stageH: number;
  centerClientX: number;
  centerClientY: number;
}

export interface BuilderCanvasProps {
  layout: LayoutDoc;
  typography: TypographyDoc;
  palette: VariantPalette;
  assets: Record<string, string>;
  content: ResolvedContent;
  scene: SceneId;
  breakpoint: Breakpoint;
  selectedId: string | null;
  showGuides: boolean;
  deviceWidth: number;
  /** Frame height, so the full-page backdrop is previewed at device size. */
  deviceHeight: number;
  onSelect: (id: string | null) => void;
  onBeginInteraction: () => void;
  onTransform: (id: string, patch: TransformOverride) => void;
}

export function BuilderCanvas({
  layout,
  typography,
  palette,
  assets,
  content,
  scene,
  breakpoint,
  selectedId,
  showGuides,
  deviceWidth,
  deviceHeight,
  onSelect,
  onBeginInteraction,
  onTransform,
}: BuilderCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const detach = useRef<(() => void) | null>(null);

  const selected = layout.layers.find((l) => l.id === selectedId) ?? null;
  const selectedTransform = selected ? resolveTransform(selected, breakpoint) : null;
  const canvas: SceneCanvas = sceneCanvas(layout, scene);
  const role = findScene(layout, scene)?.role ?? "flow";
  const stageWidth = guestStageWidth(canvas, role, deviceWidth, deviceHeight);

  /**
   * A `height: null` layer sizes itself from its image, so the selection frame
   * — which has no content of its own — would collapse to nothing and stack all
   * eight handles on one line. Measure the real element and give the frame an
   * explicit height in stage percent.
   */
  const [measuredHeightPct, setMeasuredHeightPct] = useState<number | null>(null);
  const selectedId_ = selected?.id ?? null;
  const selectedHeight = selectedTransform?.height ?? null;
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !selectedId_ || selectedHeight !== null) {
      setMeasuredHeightPct(null);
      return;
    }
    const element = stage.querySelector<HTMLElement>(`[data-layer-id="${selectedId_}"]`);
    if (!element) return;
    const measure = () => {
      const stageHeight = stage.getBoundingClientRect().height;
      // offsetHeight is pre-transform, which is the box the frame must match.
      if (stageHeight > 0 && element.offsetHeight > 0) {
        setMeasuredHeightPct((element.offsetHeight / stageHeight) * 100);
      }
    };
    measure();
    // Theme art arrives asynchronously, so the first measure often lands before
    // the image has a height.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [selectedId_, selectedHeight, scene, breakpoint, layout, assets]);
  const pageBackgroundUrl = layout.page.slot ? (assets[layout.page.slot] ?? null) : null;

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;

      const dxPx = event.clientX - g.startClientX;
      const dyPx = event.clientY - g.startClientY;

      if (g.kind === "move") {
        // Rotation is about the centre, so a screen-space delta moves the
        // centre by the same amount whatever the angle.
        onTransform(g.layerId, {
          x: round(g.start.x + (dxPx / g.stageW) * 100),
          y: round(g.start.y + (dyPx / g.stageH) * 100),
        });
        return;
      }

      if (g.kind === "rotate") {
        const angle =
          (Math.atan2(event.clientY - g.centerClientY, event.clientX - g.centerClientX) * 180) / Math.PI + 90;
        const snapped = event.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle);
        onTransform(g.layerId, { rotation: clamp(snapped, -360, 360) });
        return;
      }

      const handle = HANDLES.find((h) => h.id === g.handle);
      if (!handle) return;

      // Take the pointer delta into the layer's own unrotated frame, and undo
      // `scale` so a scaled-up element still tracks the cursor one-to-one.
      const rad = (-g.start.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const scale = g.start.scale || 1;
      const localDx = (dxPx * cos - dyPx * sin) / scale;
      const localDy = (dxPx * sin + dyPx * cos) / scale;

      const startWidthPx = (g.start.width / 100) * g.stageW;
      const growX = handle.sx === 0 ? 0 : handle.sx * localDx;
      const growY = handle.sy === 0 ? 0 : handle.sy * localDy;

      const nextWidthPx = Math.max(8, startWidthPx + growX);
      const nextHeightPx = Math.max(8, g.startHeightPx + growY);

      // Keep the opposite edge pinned: the centre moves by half the growth,
      // expressed back in screen space.
      const shiftLocalX = (handle.sx * (nextWidthPx - startWidthPx)) / 2;
      const shiftLocalY = (handle.sy * (nextHeightPx - g.startHeightPx)) / 2;
      const back = (-rad * 180) / Math.PI;
      const backRad = (back * Math.PI) / 180;
      const shiftX = (shiftLocalX * Math.cos(backRad) - shiftLocalY * Math.sin(backRad)) * scale;
      const shiftY = (shiftLocalX * Math.sin(backRad) + shiftLocalY * Math.cos(backRad)) * scale;

      const patch: TransformOverride = {
        x: round(g.start.x + (shiftX / g.stageW) * 100),
        y: round(g.start.y + (shiftY / g.stageH) * 100),
      };
      if (handle.sx !== 0) patch.width = round(clamp((nextWidthPx / g.stageW) * 100, 0.5, 400));
      if (handle.sy !== 0) patch.height = round(clamp((nextHeightPx / g.stageH) * 100, 0.5, 400));

      onTransform(g.layerId, patch);
    },
    [onTransform],
  );

  // Latest handler, read by the listener registered at pointer-down. Kept in a
  // ref so that listener never goes stale without being re-registered.
  const moveRef = useRef(handlePointerMove);
  useEffect(() => {
    moveRef.current = handlePointerMove;
  }, [handlePointerMove]);

  const startGesture = useCallback(
    (event: React.PointerEvent, layer: Layer, kind: Gesture["kind"], handle?: HandleId) => {
      const stage = stageRef.current;
      if (!stage || layer.locked) return;

      const rect = stage.getBoundingClientRect();
      const transform = resolveTransform(layer, breakpoint);
      const element = stage.querySelector<HTMLElement>(`[data-layer-id="${layer.id}"]`);
      // `offsetHeight`, not `getBoundingClientRect().height`: the latter is the
      // AXIS-ALIGNED bounding box of an already rotated and scaled element
      // (|h·cosθ| + |w·sinθ|), so resizing a rotated auto-height layer would
      // start from a number that isn't its height at all and the box would jump.
      const startHeightPx =
        transform.height === null
          ? (element?.offsetHeight ?? rect.height * 0.2)
          : (transform.height / 100) * rect.height;

      gesture.current = {
        kind,
        layerId: layer.id,
        handle,
        startClientX: event.clientX,
        startClientY: event.clientY,
        start: transform,
        startHeightPx,
        stageW: rect.width,
        stageH: rect.height,
        centerClientX: rect.left + (transform.x / 100) * rect.width,
        centerClientY: rect.top + (transform.y / 100) * rect.height,
      };

      // Registered here rather than from an effect keyed on `dragging`: an
      // effect only runs after the next render, so a quick flick can finish
      // before the listeners exist and the drag silently does nothing.
      const onMove = (moveEvent: PointerEvent) => moveRef.current(moveEvent);
      const onUp = () => detach.current?.();
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      detach.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        detach.current = null;
        gesture.current = null;
      };

      event.preventDefault();
      event.stopPropagation();
      onBeginInteraction();
    },
    [breakpoint, onBeginInteraction],
  );

  // Unmounting mid-drag would otherwise leave the window listeners behind.
  useEffect(() => () => detach.current?.(), []);

  /** Nudge the selection with the arrow keys — the only way to hit exact values. */
  useEffect(() => {
    if (!selected || !selectedTransform) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const step = event.shiftKey ? 1 : 0.2;
      const map: Record<string, TransformOverride> = {
        ArrowLeft: { x: round(selectedTransform!.x - step) },
        ArrowRight: { x: round(selectedTransform!.x + step) },
        ArrowUp: { y: round(selectedTransform!.y - step) },
        ArrowDown: { y: round(selectedTransform!.y + step) },
      };
      const patch = map[event.key];
      if (!patch) return;
      event.preventDefault();
      onTransform(selected!.id, patch);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, selectedTransform, onTransform]);

  const onStagePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-layer-id]");
      const layerId = element?.dataset.layerId;
      if (!layerId) {
        onSelect(null);
        return;
      }
      const layer = layout.layers.find((l) => l.id === layerId);
      if (!layer || layer.locked) {
        onSelect(layer ? layer.id : null);
        return;
      }
      onSelect(layer.id);
      startGesture(event, layer, "move");
    },
    [layout.layers, onSelect, startGesture],
  );

  return (
    <div className="flex justify-center">
      {/*
        The device frame. The page background is full-viewport on a guest's
        phone, so previewing it means giving the editor a viewport too — hence
        the preset height, with the scene stage centred inside it.

        The frame is exactly the device size — the same box the guest's viewport
        gives the background — and the stage is capped inside it with the
        guest's own formula, so what is previewed here is what ships.
      */}
      <div
        // No `overflow-hidden`: the rotate handle sits above the stage's top
        // edge, and clipping it here would hide it whenever the stage fills the
        // frame. The backdrop is a CSS background, which never spills anyway.
        className="relative flex items-center justify-center shadow-2xl"
        style={{
          width: deviceWidth,
          height: deviceHeight,
          maxWidth: "100%",
          backgroundColor: palette.bg,
        }}
      >
        {pageBackgroundUrl && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url("${pageBackgroundUrl}")`,
              backgroundSize: layout.page.fit,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
        )}
        {layout.page.overlayOpacity > 0 && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: layout.page.overlayColor, opacity: layout.page.overlayOpacity }}
          />
        )}

        {/*
          The stage wrapper. It exists only to give `SelectionFrame` the same
          box it had before: the frame is `absolute inset-0`, so its positioned
          ancestor must still be exactly the stage's rectangle — no padding, no
          border, and the stage as its only in-flow child.
        */}
        <div className="relative" style={{ width: stageWidth }}>
          <ThemeStage
            ref={stageRef}
            scene={scene}
            layout={layout}
            typography={typography}
            palette={palette}
            assets={assets}
            content={content}
            breakpoint={breakpoint}
            className="touch-none select-none"
            // Every layer stays clickable so it can be selected and dragged,
            // interactive layers render inert, and the QR draws its sample.
            editing
            // The stage paints `palette.bg` by default, which would hide the
            // page art behind it. With a backdrop present the frame carries
            // that colour instead and the stage lets it through.
            style={pageBackgroundUrl ? { backgroundColor: "transparent" } : undefined}
            onPointerDown={onStagePointerDown}
          >
            {showGuides && <Guides safeInset={canvas.safeInset} />}
          </ThemeStage>

          {selected && selectedTransform && (
            <SelectionFrame
              transform={{ ...selectedTransform, height: selectedTransform.height ?? measuredHeightPct }}
              locked={selected.locked}
              onHandleDown={(event, handle) => startGesture(event, selected, "resize", handle)}
              onRotateDown={(event) => startGesture(event, selected, "rotate")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SelectionFrame({
  transform,
  locked,
  onHandleDown,
  onRotateDown,
}: {
  transform: Transform;
  locked: boolean;
  onHandleDown: (event: React.PointerEvent, handle: HandleId) => void;
  onRotateDown: (event: React.PointerEvent) => void;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      // The frame sits above the stage, so it must not eat clicks meant for
      // layers — only the handles themselves opt back into pointer events.
      style={{ zIndex: 40 }}
    >
      <div style={{ ...boxStyle(transform), opacity: 1 }}>
        <div
          className={`absolute inset-0 border-2 ${locked ? "border-warning border-dashed" : "border-accent"}`}
        />
        {!locked && (
          <>
            {HANDLES.map((handle) => (
              <button
                key={handle.id}
                type="button"
                aria-label={handle.id}
                onPointerDown={(event) => onHandleDown(event, handle.id)}
                className="pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-accent shadow"
                style={{
                  left: `${50 + handle.sx * 50}%`,
                  top: `${50 + handle.sy * 50}%`,
                  cursor: handle.cursor,
                  touchAction: "none",
                }}
              />
            ))}
            <button
              type="button"
              aria-label="rotate"
              onPointerDown={onRotateDown}
              className="pointer-events-auto absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border border-white bg-accent-strong shadow"
              style={{ top: -28, cursor: "grab", touchAction: "none" }}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Design-time only — never rendered on a guest's invitation. */
function Guides({ safeInset }: { safeInset: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 30 }}>
      <div
        className="absolute border border-dashed border-sky-400/70"
        style={{ inset: `${safeInset}%` }}
      />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-fuchsia-400/50" />
      <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-fuchsia-400/50" />
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
