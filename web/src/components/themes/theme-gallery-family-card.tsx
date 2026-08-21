"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";

function formatColorCount(n: number, dict: Dictionary) {
  const g = dict.themesGallery;
  if (n === 1) return g.colorCountOne;
  if (n === 2) return g.colorCountTwo;
  if (n >= 3 && n <= 10) return g.colorCountFew.replace("{n}", String(n));
  return g.colorCountMany.replace("{n}", String(n));
}

/** One design with several color variants — a single card with clickable swatches, instead of one card per color. */
export function ThemeGalleryFamilyCard({
  name,
  categoryLabel,
  variants,
  dict,
  onPreview,
  initialSelectedIndex = 0,
}: {
  name: string;
  categoryLabel: string;
  variants: Array<{ id: string; config: ThemeConfig }>;
  dict: Dictionary;
  onPreview: (variantId: string) => void;
  /** Which swatch to show first — e.g. the color the customer just filtered by. */
  initialSelectedIndex?: number;
}) {
  const [selected, setSelected] = useState(initialSelectedIndex);
  const active = variants[selected] ?? variants[0];
  const isAnimated = Boolean(active.config.card?.style);

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl p-8 text-center shadow-sm transition-colors"
      style={{ background: active.config.palette.bg, color: active.config.palette.fg }}
    >
      <p className="text-lg">{name}</p>
      <p className="text-xs" style={{ color: active.config.palette.fgMuted }}>
        {categoryLabel}
        {isAnimated && ` · ${dict.themesGallery.animatedTag}`}
      </p>

      <div className="flex items-center gap-2">
        {variants.map((variant, i) => {
          const swatchColor = variant.config.palette.swatch ?? variant.config.palette.accent;
          return (
          <button
            key={variant.id}
            type="button"
            aria-label={variant.config.colorTag ?? String(i + 1)}
            onClick={() => setSelected(i)}
            className="h-6 w-6 rounded-full transition-transform"
            style={{
              background: swatchColor,
              boxShadow: i === selected ? `0 0 0 2px ${active.config.palette.bg}, 0 0 0 4px ${swatchColor}` : "none",
              transform: i === selected ? "scale(1.1)" : "scale(1)",
            }}
          />
          );
        })}
      </div>

      <p className="text-xs" style={{ color: active.config.palette.fgMuted }}>
        {formatColorCount(variants.length, dict)}
      </p>

      <button
        type="button"
        onClick={() => onPreview(active.id)}
        className="h-9 rounded-full border px-5 text-xs font-medium transition-colors"
        style={{ borderColor: active.config.palette.accent, color: active.config.palette.accent }}
      >
        {dict.themesGallery.previewDesign}
      </button>
    </div>
  );
}
