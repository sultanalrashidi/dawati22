"use client";

import { useState } from "react";
import type { ThemeConfig } from "@/lib/themes/types";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { BuilderTheme } from "@/components/guest/invitation-view";
import { ThemePreviewDialog } from "@/components/themes/theme-preview-dialog";

/**
 * One selectable option. A LEGACY theme contributes exactly one (each of its
 * colours is its own Theme row); a BUILDER theme contributes one per colour,
 * all sharing a `themeId` and differing by `variantId`.
 */
export interface ThemeOption {
  /** Unique per option — `themeId` for legacy, `themeId:variantId` otherwise. */
  key: string;
  themeId: string;
  variantId: string | null;
  name: string;
  /** The colour's own name, shown under the design name when there is one. */
  variantName?: string;
  category: string;
  config: ThemeConfig;
  builder?: BuilderTheme;
}

export function ThemePicker({ options, dict }: { options: ThemeOption[]; dict: Dictionary }) {
  const [selectedKey, setSelectedKey] = useState(options[0]?.key ?? "");
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const selected = options.find((o) => o.key === selectedKey) ?? options[0];
  const preview = options.find((o) => o.key === previewKey);

  return (
    <div>
      {/*
        The submitted pair. Two hidden inputs rather than a radio per card
        because a colour needs BOTH ids — sending only `themeId`, as this picker
        used to, silently gave every customer the design's default colour no
        matter which swatch they picked.
      */}
      <input type="hidden" name="themeId" value={selected?.themeId ?? ""} />
      <input type="hidden" name="themeVariantId" value={selected?.variantId ?? ""} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <div
            key={option.key}
            role="radio"
            aria-checked={selectedKey === option.key}
            aria-label={option.variantName ? `${option.name} — ${option.variantName}` : option.name}
            tabIndex={0}
            onClick={() => setSelectedKey(option.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedKey(option.key);
              }
            }}
            className={`cursor-pointer rounded-xl border p-3 transition-colors ${
              selectedKey === option.key ? "border-accent" : "border-border hover:border-fg-muted"
            }`}
          >
            <div
              className="h-16 w-full rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${option.config.palette.bg}, ${option.config.palette.accent})`,
              }}
            />
            <p className="mt-2 text-center text-xs font-medium text-fg">{option.name}</p>
            {option.variantName && (
              <p className="text-center text-[11px] text-fg-muted">{option.variantName}</p>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewKey(option.key);
              }}
              className="mt-2 h-7 w-full rounded-full border border-border text-xs text-fg-muted transition-colors hover:bg-surface-2"
            >
              {dict.admin.preview}
            </button>
          </div>
        ))}
      </div>

      {preview && (
        <ThemePreviewDialog
          key={preview.key}
          variants={[{ id: preview.key, config: preview.config, builder: preview.builder }]}
          initialVariantId={preview.key}
          themeCategory={preview.category}
          dict={dict}
          open={Boolean(preview)}
          onOpenChange={(open) => !open && setPreviewKey(null)}
        />
      )}
    </div>
  );
}
