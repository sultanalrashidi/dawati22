"use client";

import type { CSSProperties } from "react";
import type { ButtonLayer, TypographyDoc } from "@/lib/themes/builder/types";
import { borderCss, scaled, textStyleToCss, withOpacity } from "./style";

/**
 * One guest action — add to calendar, open the map, play the music, or a link
 * the admin typed.
 *
 * Every target arrives as a prop. When the one this button needs is missing the
 * control renders **disabled** rather than as an anchor to nowhere: a designed
 * invitation that silently navigates to `#` looks broken to the guest, while a
 * dimmed button reads as "not set up for this event" — and in the editor it is
 * an honest preview of a button whose destination the admin has not filled in.
 */
export function ButtonContent({
  layer,
  typography,
  linkToken,
  mapUrl,
  musicPlaying,
  editing = false,
  onToggleMusic,
}: {
  layer: ButtonLayer;
  typography: TypographyDoc;
  linkToken?: string | null;
  mapUrl?: string | null;
  musicPlaying?: boolean;
  /** True in the admin canvas: every destination is suppressed. */
  editing?: boolean;
  onToggleMusic?: (() => void) | null;
}) {
  const style: CSSProperties = {
    ...textStyleToCss(layer.style, typography),
    textAlign: "center",
    backgroundColor: withOpacity(layer.background, layer.backgroundOpacity),
    border: borderCss(layer.borderWidth, layer.borderColor),
    borderRadius: scaled(layer.borderRadius),
    padding: `${scaled(6)} ${scaled(14)}`,
  };
  const className = "flex h-full w-full items-center justify-center whitespace-nowrap";
  const label = layer.label;

  if (layer.action === "music") {
    if (!onToggleMusic) return <DisabledControl className={className} style={style} label={label} />;
    return (
      <button
        type="button"
        dir="rtl"
        onClick={onToggleMusic}
        aria-pressed={Boolean(musicPlaying)}
        className={className}
        style={style}
      >
        {label}
      </button>
    );
  }

  const href = hrefFor(layer, linkToken, mapUrl, editing);
  if (!href) return <DisabledControl className={className} style={style} label={label} />;

  // The calendar route serves the event's own .ics from this site; the map and
  // a custom link both leave it, so they open beside the invitation instead of
  // navigating the guest away from a card they may not find their way back to.
  const external = layer.action !== "calendar";

  return (
    <a
      href={href}
      dir="rtl"
      className={className}
      style={style}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {label}
    </a>
  );
}

function hrefFor(
  layer: ButtonLayer,
  linkToken?: string | null,
  mapUrl?: string | null,
  editing = false,
): string | null {
  switch (layer.action) {
    case "calendar":
      return linkToken ? `/i/${linkToken}/calendar` : null;
    case "map":
      return mapUrl?.trim() || null;
    case "link":
      // Suppressed while editing for the same reason as the other actions —
      // see the call site in theme-stage.tsx.
      return editing ? null : (layer.href.trim() || null);
    default:
      return null;
  }
}

/**
 * A button with nowhere to go.
 *
 * Rendered as a `<span>` rather than a `<button disabled>` on purpose: a
 * disabled form control swallows mouse events instead of bubbling them, and the
 * theme editor selects and drags a layer from exactly that bubbling
 * `pointerdown` — a disabled element would be a layer the admin could see but
 * never pick up. A span is inert to the guest and transparent to the editor.
 */
function DisabledControl({
  className,
  style,
  label,
}: {
  className: string;
  style: CSSProperties;
  label: string;
}) {
  return (
    <span
      role="button"
      aria-disabled="true"
      dir="rtl"
      className={`${className} cursor-not-allowed`}
      style={{ ...style, opacity: 0.45 }}
    >
      {label}
    </span>
  );
}
