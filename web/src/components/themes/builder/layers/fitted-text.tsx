"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { fittedFloor } from "@/lib/themes/builder/text-fit";

/**
 * Keep long real names inside the designer's box. Measure after fonts load
 * and on resize; never truncate guest data. Exceptionally long copy becomes
 * a keyboard/touch-scrollable region instead of microscopic or clipped text.
 * The editor uses this same component, so what is arranged is what is sent.
 *
 * `referenceSize` is the font size the layer was authored at on the 390px
 * reference stage. It makes the shrink floor scale with the stage, so a box
 * that fits in the editor fits on every phone rather than only on wide ones.
 */
export function FittedText({ lines, style, referenceSize, editing = false }: {
  lines: string[];
  style: CSSProperties;
  referenceSize?: number;
  editing?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;
    let cancelled = false;

    function fit() {
      if (cancelled || !box || !text || box.clientWidth === 0 || box.clientHeight === 0) return;
      // The box retains the authored cqw size; only its inner text is fitted.
      const authored = Number.parseFloat(getComputedStyle(box).fontSize);
      if (!Number.isFinite(authored)) return;
      const minimum = fittedFloor(authored, referenceSize ?? authored);
      const fits = () => text.scrollHeight <= box.clientHeight + 1 && text.scrollWidth <= box.clientWidth + 1;
      text.style.fontSize = `${authored}px`;
      if (!fits()) {
        let low = minimum;
        let high = authored;
        for (let i = 0; i < 8; i++) {
          const mid = (low + high) / 2;
          text.style.fontSize = `${mid}px`;
          if (fits()) low = mid;
          else high = mid;
        }
        text.style.fontSize = `${low}px`;
      }
      const overflowing = !fits();
      box.style.overflow = overflowing ? "auto" : "visible";
      box.style.justifyContent = overflowing ? "flex-start" : String(style.justifyContent ?? "center");
      box.style.pointerEvents = overflowing && !editing ? "auto" : "";
      if (overflowing && !editing) {
        box.tabIndex = 0;
        box.setAttribute("role", "region");
        box.setAttribute("aria-label", "نص الدعوة — قابل للتمرير");
      } else {
        box.removeAttribute("tabindex");
        box.removeAttribute("role");
        box.removeAttribute("aria-label");
      }
      box.dataset.textOverflow = overflowing ? "scroll" : "none";
    }

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      cancelled = true;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [lines, style, referenceSize, editing]);

  return (
    <div ref={boxRef} dir="rtl" className="flex h-full w-full flex-col overscroll-contain focus-visible:outline-2 focus-visible:outline-offset-2" style={style}>
      <div ref={textRef} className="w-full shrink-0">
        {lines.map((line, index) => (
          <span key={index} className="block whitespace-pre-wrap break-words text-balance"
            style={/[\u0600-\u06ff]/.test(line) ? { letterSpacing: 0 } : undefined}>
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
