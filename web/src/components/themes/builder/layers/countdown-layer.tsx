"use client";

import { useState, useSyncExternalStore } from "react";
import { SAMPLE_CONTENT_INPUT } from "@/lib/themes/builder/content";
import type { CountdownLayer, TypographyDoc } from "@/lib/themes/builder/types";
import { borderCss, justifyFor, scaled, textStyleToCss, withOpacity } from "./style";

/**
 * The live counter to the event.
 *
 * ## Hydration
 *
 * A countdown is the textbook hydration mismatch: the server renders "83" at
 * one instant and the browser hydrates a moment later with a different number,
 * and React throws away the server HTML for that subtree. The fix here is the
 * one React documents for exactly this shape of problem —
 * `useSyncExternalStore` with a *third* argument. `getServerSnapshot` returns
 * `null`, and React uses that same value both when rendering on the server and
 * for the client's very first (hydrating) render, so the two are identical by
 * construction rather than by luck. Only once hydration has committed does
 * React read `getSnapshot`, notice it moved, and re-render with real digits.
 *
 * While the snapshot is `null` the columns still render, carrying a dash in
 * place of each number: the frame keeps its authored size, so the swap to live
 * digits changes glyphs and never geometry.
 *
 * The clock itself is one module-level interval shared by every countdown layer
 * on the page — a theme with the counter on two scenes should not run two.
 * `getSnapshot` returns that cached timestamp rather than calling `Date.now()`,
 * because a snapshot that changes on every read makes React re-render forever.
 */

/** Stands in for a digit until the client's clock takes over. */
const PENDING_DIGIT = "—";

const TICK_MS = 1000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let tick = 0;

function subscribeToClock(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    tick = Date.now();
    timer = setInterval(() => {
      tick = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      // Reset the cached time too. Leaving it set means a later remount renders
      // a stale timestamp and stays wrong until the next tick fires.
      tick = 0;
    }
  };
}

/**
 * Subscription used by a countdown that has already reached zero. It holds no
 * listener, so once every countdown on the page is finished the shared interval
 * has nothing left to notify and stops itself — an invitation revisited after
 * the wedding should not tick at 1 Hz forever.
 */
function subscribeToNothing(): () => void {
  return () => {};
}

function clockSnapshot(): number {
  if (tick === 0) tick = Date.now();
  return tick;
}

/** Shared by the server render and the client's hydrating render — see above. */
function clockServerSnapshot(): null {
  return null;
}

interface CountdownPart {
  key: string;
  label: string;
  value: number;
  /**
   * The three wrapping columns are padded to two digits. Without it "9" becomes
   * "10" a second later and every column shifts, which is very visible in a
   * design the admin centred by eye. Days never wrap, so they are never padded.
   */
  pad: boolean;
}

function partsFor(remainingMs: number, showSeconds: boolean): CountdownPart[] {
  const total = Math.max(0, remainingMs);
  const parts: CountdownPart[] = [
    { key: "days", label: "يوم", value: Math.floor(total / 86_400_000), pad: false },
    { key: "hours", label: "ساعة", value: Math.floor((total / 3_600_000) % 24), pad: true },
    { key: "minutes", label: "دقيقة", value: Math.floor((total / 60_000) % 60), pad: true },
    { key: "seconds", label: "ثانية", value: Math.floor((total / 1000) % 60), pad: true },
  ];
  return showSeconds ? parts : parts.slice(0, 3);
}

export function CountdownContent({
  layer,
  typography,
  eventDateIso,
}: {
  layer: CountdownLayer;
  typography: TypographyDoc;
  /**
   * The real event time. Absent in the editor, where the sample invitation's
   * date stands in so the admin arranges the block around plausible digits
   * rather than four zeros.
   */
  eventDateIso?: string;
}) {
  const [finished, setFinished] = useState(false);
  const now = useSyncExternalStore<number | null>(
    finished ? subscribeToNothing : subscribeToClock,
    clockSnapshot,
    clockServerSnapshot,
  );

  const target = new Date(eventDateIso ?? SAMPLE_CONTENT_INPUT.eventDate).getTime();
  const remaining = Number.isNaN(target) || now === null ? 0 : target - now;
  const parts = partsFor(remaining, layer.showSeconds);

  // Adjusting state during render — React's documented pattern for state that
  // is derived from a previous render — rather than in an effect, so the
  // resubscribe happens before the browser paints instead of one frame later.
  // `now === null` on the hydrating render, where `remaining` is 0 by
  // construction; checking it keeps that first render from being mistaken for
  // an expired event and detaching the clock before it ever starts. The
  // comparison runs both ways, so changing the date in the editor restarts a
  // countdown that had already finished.
  const expired = now !== null && remaining <= 0;
  if (finished !== expired) setFinished(expired);

  const titleCss = textStyleToCss(layer.titleStyle, typography);
  const numberCss = textStyleToCss(layer.numberStyle, typography);
  const labelCss = textStyleToCss(layer.labelStyle, typography);

  return (
    <div
      dir="rtl"
      className="flex h-full w-full flex-col"
      style={{ gap: scaled(8), justifyContent: justifyFor(layer.titleStyle.align) }}
    >
      {layer.title && <div style={titleCss}>{layer.title}</div>}
      <div
        className="flex w-full items-center justify-center"
        style={{
          gap: scaled(10),
          padding: `${scaled(10)} ${scaled(12)}`,
          backgroundColor: withOpacity(layer.boxColor, layer.boxOpacity),
          border: borderCss(layer.borderWidth, layer.borderColor),
          borderRadius: scaled(layer.borderRadius),
        }}
      >
        {parts.map((part) => (
          <div key={part.key} className="flex flex-1 flex-col items-center" style={{ gap: scaled(2) }}>
            {/* Plain Latin digits, never `toLocaleString`: an ICU difference
                between the server's Node build and the browser would put the
                mismatch straight back. */}
            <span style={{ ...numberCss, textAlign: "center" }}>
              {now === null
                ? PENDING_DIGIT
                : part.pad
                  ? String(part.value).padStart(2, "0")
                  : String(part.value)}
            </span>
            <span style={{ ...labelCss, textAlign: "center" }}>{part.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
