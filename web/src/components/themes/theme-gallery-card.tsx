"use client";

import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";

export interface GalleryVariant {
  id: string;
  config: ThemeConfig;
  /** The design's own closed-envelope art, when it has any. */
  thumbnailUrl?: string;
  /**
   * The colour's name in the reader's language. `config.colorTag` is stored as
   * an Arabic word, so it is a key, not a label — the grid resolves it.
   */
  colorLabel?: string;
}

/**
 * One design in the gallery.
 *
 * The card leads with the design's own closed-envelope photo — the first thing
 * a guest actually sees — rather than a block tinted with its palette, which
 * made two colours of one design look like the same card twice and told a
 * visitor nothing about the art they were choosing. Colours of one design
 * share this card; the swatches switch which one is on show.
 */
export function ThemeGalleryCard({
  name,
  categoryLabel,
  colorCountLabel,
  variants,
  shownId,
  onShow,
  onPreview,
  dict,
}: {
  name: string;
  categoryLabel: string;
  /** Only present when the design has more than one colour. */
  colorCountLabel?: string;
  variants: GalleryVariant[];
  shownId: string;
  onShow: (variantId: string) => void;
  onPreview: (variantId: string) => void;
  dict: Dictionary;
}) {
  const shown = variants.find((v) => v.id === shownId) ?? variants[0];

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-colors hover:border-accent">
      <button
        type="button"
        onClick={() => onPreview(shown.id)}
        aria-label={`${name} — ${dict.themesGallery.previewDesign}`}
        className="block w-full"
      >
        <span
          className="block aspect-[3/2] w-full"
          style={{
            background: shown.thumbnailUrl
              ? undefined
              : `linear-gradient(135deg, ${shown.config.palette.bg}, ${shown.config.palette.accent})`,
          }}
        >
          {shown.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-base font-bold leading-tight text-fg">{name}</p>
          {/* The "animated" tag used to sit here. Every published design has
              a card style, so it appeared on all of them and distinguished
              nothing — it was noise in the one line that has to be scanned. */}
          <p className="mt-1 text-xs text-fg-muted">
            {[categoryLabel, colorCountLabel].filter(Boolean).join(" · ")}
          </p>
        </div>

        {variants.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const swatch = variant.config.palette.swatch ?? variant.config.palette.accent;
              const isShown = variant.id === shown.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  aria-label={variant.colorLabel ?? variant.config.colorTag ?? variant.id}
                  aria-pressed={isShown}
                  onClick={() => onShow(variant.id)}
                  className="h-6 w-6 rounded-full border border-border transition-transform hover:scale-110"
                  style={{
                    background: swatch,
                    outline: isShown ? "2px solid var(--color-accent)" : undefined,
                    outlineOffset: "2px",
                  }}
                />
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => onPreview(shown.id)}
          className="mt-auto h-10 rounded-full border border-accent text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-accent-fg"
        >
          {dict.themesGallery.previewDesign}
        </button>
      </div>
    </div>
  );
}
