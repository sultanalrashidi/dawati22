"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GhostButton, Panel } from "@/components/admin/builder/builder-ui";
import { ALL_SLOTS, CORE_SLOTS, OPTIONAL_SLOTS, SLOT_KEY_PATTERN } from "@/lib/themes/builder/slots";
import { uploadThemeAsset } from "@/lib/themes/builder/upload-client";
import { deleteThemeAssetAction } from "@/lib/admin/themes/builder-actions";

export interface AssetRow {
  id: string;
  slot: string;
  url: string;
  variantId: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
}

/**
 * Per-variant image management.
 *
 * Slots are shown as named drop targets rather than a flat upload list, because
 * the question an admin is answering is "which picture is the closed envelope
 * for this colour" — not "what files exist".
 */
export function AssetsPanel({
  themeId,
  variantId,
  variantName,
  assets,
  blobEnabled,
  locale,
  onUploaded,
}: {
  themeId: string;
  variantId: string;
  variantName: string;
  assets: AssetRow[];
  blobEnabled: boolean;
  locale: string;
  onUploaded: () => void;
}) {
  const [customSlots, setCustomSlots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Slots the theme already uses but that aren't in the curated list — so a
  // custom slot added earlier keeps showing up after a reload.
  const knownKeys = new Set(ALL_SLOTS.map((s) => s.key));
  const discovered = [...new Set(assets.map((a) => a.slot))].filter((slot) => !knownKeys.has(slot));
  const extraSlots = [...new Set([...discovered, ...customSlots])];

  function addCustomSlot() {
    const key = window.prompt("مفتاح الصورة الجديد بالإنجليزية (مثال: bouquet)")?.trim();
    if (!key) return;
    if (!SLOT_KEY_PATTERN.test(key)) {
      setError("المفتاح لازم يبدأ بحرف إنجليزي، وبدون مسافات أو رموز");
      return;
    }
    setError(null);
    setCustomSlots((current) => [...new Set([...current, key])]);
  }

  return (
    <Panel title={`صور اللون: ${variantName}`} action={<GhostButton onClick={addCustomSlot}>+ نوع صورة</GhostButton>}>
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      <div className="flex flex-col gap-3">
        <SlotGroup
          title="الصور الأساسية (مطلوبة للنشر)"
          slots={CORE_SLOTS.map((s) => ({ key: s.key, label: s.labelAr, hint: s.hintAr }))}
          {...{ themeId, variantId, assets, blobEnabled, locale, onUploaded }}
        />
        <SlotGroup
          title="صور اختيارية"
          slots={OPTIONAL_SLOTS.map((s) => ({ key: s.key, label: s.labelAr, hint: s.hintAr }))}
          {...{ themeId, variantId, assets, blobEnabled, locale, onUploaded }}
        />
        {extraSlots.length > 0 && (
          <SlotGroup
            title="صور مخصصة"
            slots={extraSlots.map((key) => ({ key, label: key, hint: "" }))}
            {...{ themeId, variantId, assets, blobEnabled, locale, onUploaded }}
          />
        )}
      </div>
    </Panel>
  );
}

function SlotGroup({
  title,
  slots,
  themeId,
  variantId,
  assets,
  blobEnabled,
  locale,
  onUploaded,
}: {
  title: string;
  slots: { key: string; label: string; hint: string }[];
  themeId: string;
  variantId: string;
  assets: AssetRow[];
  blobEnabled: boolean;
  locale: string;
  onUploaded: () => void;
}) {
  return (
    <div>
      <h4 className="mb-1 text-[11px] font-medium text-fg-muted">{title}</h4>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot) => (
          <SlotTile
            key={slot.key}
            slotKey={slot.key}
            label={slot.label}
            hint={slot.hint}
            asset={assets.find((a) => a.slot === slot.key && (a.variantId === variantId || a.variantId === null))}
            themeId={themeId}
            variantId={variantId}
            blobEnabled={blobEnabled}
            locale={locale}
            onUploaded={onUploaded}
          />
        ))}
      </div>
    </div>
  );
}

function SlotTile({
  slotKey,
  label,
  hint,
  asset,
  themeId,
  variantId,
  blobEnabled,
  locale,
  onUploaded,
}: {
  slotKey: string;
  label: string;
  hint: string;
  asset?: AssetRow;
  themeId: string;
  variantId: string;
  blobEnabled: boolean;
  locale: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      await uploadThemeAsset({ file, themeId, variantId, slot: slotKey, blobEnabled });
      startTransition(() => {
        router.refresh();
        onUploaded();
      });
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-lg border border-border bg-bg p-2"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
    >
      <div className="mb-1 flex items-start justify-between gap-1">
        <span className="text-[11px] font-medium text-fg" title={hint}>
          {label}
        </span>
        {asset && (
          <button
            type="button"
            className="text-[11px] text-danger hover:underline"
            onClick={() => {
              if (!window.confirm(`حذف صورة «${label}»؟`)) return;
              startTransition(async () => {
                await deleteThemeAssetAction(asset.id, themeId, locale);
                router.refresh();
                onUploaded();
              });
            }}
          >
            حذف
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-surface-2 hover:border-accent disabled:opacity-50"
      >
        {busy ? (
          <span className="text-[11px] text-fg-muted">جاري الرفع…</span>
        ) : asset ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span className="px-1 text-center text-[11px] text-fg-muted">اسحب صورة هنا أو اضغط</span>
        )}
      </button>

      {asset?.width && (
        <p dir="ltr" className="mt-1 text-center text-[10px] text-fg-muted">
          {asset.width}×{asset.height}
        </p>
      )}
      {error && <p className="mt-1 text-[10px] text-danger">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
