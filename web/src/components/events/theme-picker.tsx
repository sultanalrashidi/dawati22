"use client";

import { useState } from "react";
import type { ThemeConfig } from "@/lib/themes/types";

export function ThemePicker({
  themes,
}: {
  themes: Array<{ id: string; name: string; category: string; config: ThemeConfig }>;
}) {
  const [selected, setSelected] = useState(themes[0]?.id ?? "");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {themes.map((theme) => (
        <label
          key={theme.id}
          className={`cursor-pointer rounded-xl border p-3 transition-colors ${
            selected === theme.id ? "border-accent" : "border-border hover:border-fg-muted"
          }`}
        >
          <input
            type="radio"
            name="themeId"
            value={theme.id}
            checked={selected === theme.id}
            onChange={() => setSelected(theme.id)}
            className="sr-only"
          />
          <div
            className="h-16 w-full rounded-lg"
            style={{
              background: `linear-gradient(135deg, ${theme.config.palette.bg}, ${theme.config.palette.accent})`,
            }}
          />
          <p className="mt-2 text-center text-xs font-medium text-fg">{theme.name}</p>
        </label>
      ))}
    </div>
  );
}
