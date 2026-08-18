"use client";

import { useState } from "react";
import type { ThemeConfig } from "@/lib/themes/types";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { ThemePreviewDialog } from "@/components/themes/theme-preview-dialog";

export function ThemePicker({
  themes,
  dict,
}: {
  themes: Array<{ id: string; name: string; category: string; config: ThemeConfig }>;
  dict: Dictionary;
}) {
  const [selected, setSelected] = useState(themes[0]?.id ?? "");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewTheme = themes.find((t) => t.id === previewId);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {themes.map((theme) => (
        <div
          key={theme.id}
          role="radio"
          aria-checked={selected === theme.id}
          tabIndex={0}
          onClick={() => setSelected(theme.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setSelected(theme.id);
          }}
          className={`cursor-pointer rounded-xl border p-3 transition-colors ${
            selected === theme.id ? "border-accent" : "border-border hover:border-fg-muted"
          }`}
        >
          <input type="radio" name="themeId" value={theme.id} checked={selected === theme.id} readOnly className="sr-only" />
          <div
            className="h-16 w-full rounded-lg"
            style={{
              background: `linear-gradient(135deg, ${theme.config.palette.bg}, ${theme.config.palette.accent})`,
            }}
          />
          <p className="mt-2 text-center text-xs font-medium text-fg">{theme.name}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewId(theme.id);
            }}
            className="mt-2 h-7 w-full rounded-full border border-border text-xs text-fg-muted transition-colors hover:bg-surface-2"
          >
            {dict.admin.preview}
          </button>
        </div>
      ))}

      {previewTheme && (
        <ThemePreviewDialog
          theme={previewTheme.config}
          dict={dict}
          previewKey={previewTheme.id}
          open={Boolean(previewTheme)}
          onOpenChange={(open) => !open && setPreviewId(null)}
        />
      )}
    </div>
  );
}
