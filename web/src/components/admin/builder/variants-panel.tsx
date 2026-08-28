"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ColorField, GhostButton, Panel, TextField } from "@/components/admin/builder/builder-ui";
import {
  createVariantAction,
  deleteVariantAction,
  duplicateVariantAction,
  setDefaultVariantAction,
  updateVariantAction,
} from "@/lib/admin/themes/builder-actions";
import type { VariantPalette } from "@/lib/themes/builder/types";

import type { LayoutOverrides } from "@/lib/themes/builder/resolve";

export interface VariantRow {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  colorTag: string | null;
  palette: VariantPalette;
  /** This variant's own colours and geometry tweaks, keyed by layer id. */
  overrides: LayoutOverrides;
  isDefault: boolean;
}

const PALETTE_LABELS: { key: keyof VariantPalette; label: string }[] = [
  { key: "bg", label: "الخلفية" },
  { key: "surface", label: "السطح" },
  { key: "fg", label: "النص" },
  { key: "fgMuted", label: "نص ثانوي" },
  { key: "accent", label: "اللون المميز" },
  { key: "accentFg", label: "نص فوق المميز" },
];

export function VariantsPanel({
  themeId,
  locale,
  variants,
  activeId,
  onSelect,
}: {
  themeId: string;
  locale: string;
  variants: VariantRow[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = variants.find((v) => v.id === activeId) ?? variants[0];

  return (
    <div className="flex flex-col gap-3">
      <Panel title="الألوان" action={<GhostButton onClick={() => setAdding((v) => !v)}>+ لون</GhostButton>}>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              title={variant.nameAr}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${
                variant.id === activeId ? "border-accent bg-accent/10 text-fg" : "border-border text-fg-muted"
              }`}
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-border"
                style={{ backgroundColor: variant.palette.swatch ?? variant.palette.accent }}
              />
              {variant.nameAr}
              {variant.isDefault && <span className="text-[10px] text-accent">★</span>}
            </button>
          ))}
        </div>

        {adding && (
          <form
            className="mt-3 flex flex-col gap-2 rounded-lg border border-border p-2"
            action={(formData) => {
              startTransition(async () => {
                const state = await createVariantAction(themeId, locale, null, formData);
                if (state?.error) setError(state.error);
                else {
                  setError(null);
                  setAdding(false);
                  router.refresh();
                }
              });
            }}
          >
            <TextFieldNative name="nameAr" label="الاسم بالعربي" dir="rtl" required />
            <TextFieldNative name="name" label="الاسم بالإنجليزي" dir="ltr" required />
            <TextFieldNative name="slug" label="المعرّف" dir="ltr" required pattern="[a-z0-9-]+" />
            <TextFieldNative name="colorTag" label="تصنيف اللون (للفلتر)" dir="rtl" placeholder="وردي" />
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-full bg-accent px-4 text-xs font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
            >
              إضافة اللون
            </button>
          </form>
        )}

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}

        {active && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2">
            <GhostButton
              disabled={active.isDefault}
              onClick={() =>
                startTransition(async () => {
                  await setDefaultVariantAction(themeId, active.id, locale);
                  router.refresh();
                })
              }
            >
              اجعله الافتراضي
            </GhostButton>
            <GhostButton
              onClick={() =>
                startTransition(async () => {
                  await duplicateVariantAction(active.id, themeId, locale);
                  router.refresh();
                })
              }
            >
              نسخ اللون
            </GhostButton>
            <GhostButton
              danger
              disabled={variants.length <= 1}
              onClick={() => {
                if (!window.confirm(`حذف اللون «${active.nameAr}» وكل صوره؟`)) return;
                startTransition(async () => {
                  const state = await deleteVariantAction(active.id, themeId, locale);
                  if (state?.error) setError(state.error);
                  else router.refresh();
                });
              }}
            >
              حذف اللون
            </GhostButton>
          </div>
        )}
      </Panel>

      {active && <PaletteEditor themeId={themeId} locale={locale} variant={active} />}
    </div>
  );
}

function PaletteEditor({
  themeId,
  locale,
  variant,
}: {
  themeId: string;
  locale: string;
  variant: VariantRow;
}) {
  const router = useRouter();
  const [palette, setPalette] = useState<VariantPalette>(variant.palette);
  const [nameAr, setNameAr] = useState(variant.nameAr);
  const [colorTag, setColorTag] = useState(variant.colorTag ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  // The variant switcher swaps which row we're editing; re-seed the draft.
  const [seededFor, setSeededFor] = useState(variant.id);
  if (seededFor !== variant.id) {
    setSeededFor(variant.id);
    setPalette(variant.palette);
    setNameAr(variant.nameAr);
    setColorTag(variant.colorTag ?? "");
    setSaved(false);
  }

  return (
    <Panel title="ألوان الواجهة">
      <p className="mb-2 text-[11px] text-fg-muted">
        هذي ألوان الواجهة حول التصميم (الأزرار، النصوص، الخلفية) — الصور نفسها ما تتغيّر.
      </p>
      <div className="flex flex-col gap-2">
        <TextField label="اسم اللون" dir="rtl" value={nameAr} onChange={setNameAr} />
        <TextField label="تصنيف اللون (للفلتر)" dir="rtl" value={colorTag} onChange={setColorTag} />
        {PALETTE_LABELS.map(({ key, label }) => (
          <ColorField
            key={key}
            label={label}
            value={(palette[key] as string) ?? "#000000"}
            onChange={(value) => setPalette((current) => ({ ...current, [key]: value }))}
          />
        ))}
        <ColorField
          label="نقطة اللون في المعرض"
          value={palette.swatch ?? palette.accent}
          onChange={(value) => setPalette((current) => ({ ...current, swatch: value }))}
        />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await updateVariantAction(variant.id, themeId, locale, {
              name: variant.name,
              nameAr,
              colorTag: colorTag.trim() || null,
              palette,
            });
            setSaved(true);
            router.refresh();
          })
        }
        className="mt-3 h-9 w-full rounded-full bg-accent text-xs font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "جاري الحفظ…" : saved ? "تم الحفظ ✓" : "حفظ ألوان هذا اللون"}
      </button>
    </Panel>
  );
}

/** Uncontrolled field for the native `<form action>` above. */
function TextFieldNative({
  name,
  label,
  dir,
  required,
  pattern,
  placeholder,
}: {
  name: string;
  label: string;
  dir?: "rtl" | "ltr";
  required?: boolean;
  pattern?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-fg-muted">{label}</span>
      <input
        name={name}
        dir={dir}
        required={required}
        pattern={pattern}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm text-fg outline-none focus:border-accent"
      />
    </label>
  );
}
