"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";
import { createThemeAction, updateThemeAction, type ThemeFormState } from "@/lib/admin/themes/actions";
import { ThemePreviewDialog } from "@/components/themes/theme-preview-dialog";

const LAYOUTS: ThemeConfig["layout"][] = ["classic-center", "arch-frame", "envelope-reveal", "split-portrait"];
const MOTIONS: ThemeConfig["motion"]["openStyle"][] = [
  "fade",
  "envelope",
  "curtain",
  "gate-swing",
  "seal-break",
  "arch-reveal",
  "doors",
];
const FONTS = [
  "IBM Plex Sans Arabic",
  "Aref Ruqaa",
  "Reem Kufi",
  "Amiri",
  "Cormorant Garamond",
  "Inter",
  "Playfair Display",
  "Tajawal",
  "Bodoni Moda",
  "EB Garamond",
];

/**
 * The six colors every theme has. Listed explicitly rather than read off the
 * stored palette so the optional `swatch` gets its own labelled control in the
 * gallery section below instead of an unexplained seventh color box.
 */
const CORE_PALETTE_KEYS = ["bg", "surface", "fg", "fgMuted", "accent", "accentFg"] as const;

const DEFAULT_CONFIG: ThemeConfig = {
  layout: "classic-center",
  palette: { bg: "#ffffff", surface: "#ffffff", fg: "#111111", fgMuted: "#666666", accent: "#b08d57", accentFg: "#ffffff" },
  fonts: { arabicDisplay: "IBM Plex Sans Arabic", arabicBody: "IBM Plex Sans Arabic", latinDisplay: "Inter" },
  motion: { openStyle: "fade", reducedMotionFallback: "fade" },
  sections: { showCountdown: true, showMap: true, showRsvp: true },
};

interface Props {
  locale: string;
  dict: Dictionary;
  theme?: {
    id: string;
    slug: string;
    name: string;
    nameAr: string;
    category: string;
    description: string | null;
    descriptionAr: string | null;
    config: ThemeConfig;
  };
}

export function ThemeEditorForm({ locale, dict, theme }: Props) {
  const action = theme ? updateThemeAction.bind(null, theme.id, locale) : createThemeAction.bind(null, locale);
  const [state, formAction, isPending] = useActionState<ThemeFormState, FormData>(action, null);
  const [config, setConfig] = useState<ThemeConfig>(theme?.config ?? DEFAULT_CONFIG);
  const [category, setCategory] = useState(theme?.category ?? "");
  const [swatchOverride, setSwatchOverride] = useState(Boolean(theme?.config.palette.swatch));
  const a = dict.admin;

  function updatePalette(key: keyof ThemeConfig["palette"], value: string) {
    setConfig((c) => ({ ...c, palette: { ...c.palette, [key]: value } }));
  }

  function toggleSwatch(on: boolean) {
    setSwatchOverride(on);
    setConfig((c) => {
      const palette = { ...c.palette };
      if (on) palette.swatch = palette.swatch ?? palette.accent;
      else delete palette.swatch;
      return { ...c, palette };
    });
  }

  /** Optional effect keys are removed outright on "none" — the renderer tests `?.effect === "…"`. */
  function setEffect(key: "background" | "particles", value: string) {
    setConfig((c) => {
      const next = { ...c };
      if (key === "background") {
        if (value === "shader-silk") next.background = { effect: "shader-silk" };
        else delete next.background;
      } else if (value === "floating-hearts") {
        next.particles = { effect: "floating-hearts" };
      } else {
        delete next.particles;
      }
      return next;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form action={formAction} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.planNameAr}</span>
            <input name="nameAr" defaultValue={theme?.nameAr} required className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.planNameEn}</span>
            <input name="name" dir="ltr" defaultValue={theme?.name} required className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.slug}</span>
            <input name="slug" dir="ltr" defaultValue={theme?.slug} required pattern="[a-z0-9\-]+" className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.category}</span>
            <input name="category" value={category} onChange={(e) => setCategory(e.target.value)} required className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">{a.descriptionArLabel}</span>
          <textarea name="descriptionAr" defaultValue={theme?.descriptionAr ?? ""} rows={2} className="rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">{a.descriptionEnLabel}</span>
          <textarea name="description" dir="ltr" defaultValue={theme?.description ?? ""} rows={2} className="rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.layout}</span>
            <select
              name="layout"
              value={config.layout}
              onChange={(e) => setConfig((c) => ({ ...c, layout: e.target.value as ThemeConfig["layout"] }))}
              className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            >
              {LAYOUTS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.openStyle}</span>
            <select
              name="openStyle"
              value={config.motion.openStyle}
              onChange={(e) => setConfig((c) => ({ ...c, motion: { ...c.motion, openStyle: e.target.value as ThemeConfig["motion"]["openStyle"] } }))}
              className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            >
              {MOTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-fg-muted">{a.colors}</legend>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {CORE_PALETTE_KEYS.map((key) => (
              <label key={key} className="flex flex-col items-center gap-1 text-xs text-fg-muted">
                {key}
                <input
                  type="color"
                  name={`palette${key.charAt(0).toUpperCase()}${key.slice(1)}`}
                  value={config.palette[key]}
                  onChange={(e) => updatePalette(key, e.target.value)}
                  className="h-9 w-12 rounded border border-border bg-transparent"
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">Arabic display</span>
            <select
              name="fontArDisplay"
              value={config.fonts.arabicDisplay}
              onChange={(e) => setConfig((c) => ({ ...c, fonts: { ...c.fonts, arabicDisplay: e.target.value } }))}
              className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            >
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">Arabic body</span>
            <select
              name="fontArBody"
              value={config.fonts.arabicBody}
              onChange={(e) => setConfig((c) => ({ ...c, fonts: { ...c.fonts, arabicBody: e.target.value } }))}
              className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            >
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">Latin display</span>
            <select
              name="fontEnDisplay"
              value={config.fonts.latinDisplay}
              onChange={(e) => setConfig((c) => ({ ...c, fonts: { ...c.fonts, latinDisplay: e.target.value } }))}
              className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            >
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-1 w-full text-sm text-fg-muted">{a.sections}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="showCountdown"
              checked={config.sections.showCountdown}
              onChange={(e) => setConfig((c) => ({ ...c, sections: { ...c.sections, showCountdown: e.target.checked } }))}
            />{" "}
            Countdown
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="showMap"
              checked={config.sections.showMap}
              onChange={(e) => setConfig((c) => ({ ...c, sections: { ...c.sections, showMap: e.target.checked } }))}
            />{" "}
            Map
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="showRsvp"
              checked={config.sections.showRsvp}
              onChange={(e) => setConfig((c) => ({ ...c, sections: { ...c.sections, showRsvp: e.target.checked } }))}
            />{" "}
            RSVP
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-2 p-4">
          <legend className="px-1 text-sm font-medium text-fg">{a.themeAdvanced}</legend>
          <p className="text-xs leading-relaxed text-fg-muted">{a.themeAdvancedNote}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-fg-muted">{a.themeFamily}</span>
              <input
                name="family"
                dir="ltr"
                defaultValue={theme?.config.family ?? ""}
                pattern="[a-z0-9\-]*"
                placeholder="ivory-bloom"
                className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
              />
              <span className="text-xs leading-relaxed text-fg-muted">{a.themeFamilyHint}</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-fg-muted">{a.themeColorTag}</span>
              <input
                name="colorTag"
                defaultValue={theme?.config.colorTag ?? ""}
                placeholder="كحلي"
                className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
              />
              <span className="text-xs leading-relaxed text-fg-muted">{a.themeColorTagHint}</span>
            </label>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="paletteSwatchOverride"
                checked={swatchOverride}
                onChange={(e) => toggleSwatch(e.target.checked)}
              />{" "}
              <span className="text-fg-muted">{a.themeSwatchOverride}</span>
              <input
                type="color"
                name="paletteSwatch"
                value={config.palette.swatch ?? config.palette.accent}
                disabled={!swatchOverride}
                onChange={(e) => updatePalette("swatch", e.target.value)}
                className="h-9 w-12 rounded border border-border bg-transparent disabled:opacity-40"
              />
            </label>
            <span className="text-xs leading-relaxed text-fg-muted">{a.themeSwatchHint}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-fg-muted">{a.themeBackgroundEffect}</span>
              <select
                name="backgroundEffect"
                value={config.background?.effect ?? ""}
                onChange={(e) => setEffect("background", e.target.value)}
                className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
              >
                <option value="">{a.effectNone}</option>
                <option value="shader-silk">{a.effectShaderSilk}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-fg-muted">{a.themeParticlesEffect}</span>
              <select
                name="particlesEffect"
                value={config.particles?.effect ?? ""}
                onChange={(e) => setEffect("particles", e.target.value)}
                className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
              >
                <option value="">{a.effectNone}</option>
                <option value="floating-hearts">{a.effectFloatingHearts}</option>
              </select>
            </label>
          </div>
        </fieldset>

        {config.card && (
          <fieldset className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
            <legend className="px-1 text-sm font-medium text-fg">{a.themeArtwork}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-fg-muted">{a.themeArtworkStyle}</span>
                <p dir="ltr" className="h-10 rounded-lg border border-border bg-bg px-3 leading-10 text-fg">
                  {config.card.style}
                </p>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-fg-muted">{a.themeArtworkFolder}</span>
                <p dir="ltr" className="h-10 truncate rounded-lg border border-border bg-bg px-3 leading-10 text-fg">
                  {config.card.assetFolder ?? "—"}
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-fg-muted">{a.themeArtworkNote}</p>
          </fieldset>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="h-11 w-fit rounded-full bg-accent px-6 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {dict.common.save}
        </button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-fg-muted">{a.preview}</p>
        <div
          className="flex flex-col items-center gap-4 rounded-2xl p-8 text-center"
          style={{ background: config.palette.bg, color: config.palette.fg }}
        >
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: config.palette.accent }}>
            دعوة خاصة إلى
          </p>
          <p className="text-xl">أم فلان</p>
          <p style={{ color: config.palette.fgMuted }}>Faisal &amp; Noura</p>
          <span
            className="rounded-full border px-5 py-2 text-xs"
            style={{ borderColor: config.palette.accent, color: config.palette.accent }}
          >
            افتح الدعوة
          </span>
        </div>
        <ThemePreviewDialog
          variants={[{ id: "editor-preview", config }]}
          initialVariantId="editor-preview"
          themeCategory={category}
          dict={dict}
          trigger={
            <button
              type="button"
              className="h-10 w-full rounded-full border border-accent text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-accent-fg"
            >
              {a.openFullPreview}
            </button>
          }
        />
      </div>
    </div>
  );
}
