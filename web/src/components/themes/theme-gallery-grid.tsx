"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";
import { ThemeGalleryCard } from "@/components/themes/theme-gallery-card";
import { ThemePreviewDialog } from "@/components/themes/theme-preview-dialog";

export function ThemeGalleryGrid({
  themes,
  dict,
}: {
  themes: Array<{ id: string; name: string; category: string; config: ThemeConfig }>;
  dict: Dictionary;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewTheme = themes.find((t) => t.id === previewId);

  return (
    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {themes.map((theme) => (
        <ThemeGalleryCard
          key={theme.id}
          name={theme.name}
          category={theme.category}
          config={theme.config}
          dict={dict}
          onPreview={() => setPreviewId(theme.id)}
        />
      ))}

      {previewTheme && (
        <ThemePreviewDialog
          theme={previewTheme.config}
          themeCategory={previewTheme.category}
          dict={dict}
          previewKey={previewTheme.id}
          open={Boolean(previewTheme)}
          onOpenChange={(open) => !open && setPreviewId(null)}
        />
      )}
    </div>
  );
}
