"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BuilderCanvas } from "@/components/admin/builder/builder-canvas";
import { AssetsPanel, type AssetRow } from "@/components/admin/builder/assets-panel";
import { InspectorPanel } from "@/components/admin/builder/inspector-panel";
import { LayersPanel } from "@/components/admin/builder/layers-panel";
import { VariantsPanel, type VariantRow } from "@/components/admin/builder/variants-panel";
import { SettingsPanel } from "@/components/admin/builder/settings-panel";
import { GhostButton } from "@/components/admin/builder/builder-ui";
import { createLayer } from "@/components/admin/builder/layer-factory";
import { useBuilderState } from "@/components/admin/builder/use-builder-state";
import { CORE_SLOTS } from "@/lib/themes/builder/slots";
import { buildAssetMap } from "@/lib/themes/builder/resolve";
import { resolveContent, SAMPLE_CONTENT_INPUT } from "@/lib/themes/builder/content";
import { parseLayoutDoc } from "@/lib/themes/builder/schema";
import {
  DEVICE_PRESETS,
  SCENE_IDS,
  type Breakpoint,
  type LayerType,
  type LayoutDoc,
  type SceneId,
  type TypographyDoc,
} from "@/lib/themes/builder/types";
import type { FontOption } from "@/lib/themes/font-registry";
import {
  applyStarterLayoutAction,
  checkBuilderThemeAction,
  publishBuilderThemeAction,
  saveLayoutAction,
} from "@/lib/admin/themes/builder-actions";
import type { ValidationIssue } from "@/lib/admin/themes/builder-service";

const SCENE_LABELS: Record<SceneId, string> = {
  cover: "١ · الظرف المغلق",
  open: "٢ · الظرف المفتوح",
  pass: "٣ · بطاقة الدخول",
};

const ADD_BUTTONS: { type: LayerType; label: string }[] = [
  { type: "text", label: "+ نص" },
  { type: "seal", label: "+ ختم" },
  { type: "qr", label: "+ باركود" },
];

type SidePanel = "design" | "assets" | "colors" | "settings";

const SIDE_TABS: { id: SidePanel; label: string }[] = [
  { id: "design", label: "التصميم" },
  { id: "assets", label: "الصور" },
  { id: "colors", label: "الألوان" },
  { id: "settings", label: "الإعدادات" },
];

export function ThemeBuilder({
  themeId,
  themeStatus,
  locale,
  initialLayout,
  typography,
  variants,
  assets,
  fonts,
  blobEnabled,
}: {
  themeId: string;
  themeStatus: string;
  locale: string;
  initialLayout: LayoutDoc;
  typography: TypographyDoc;
  variants: VariantRow[];
  assets: AssetRow[];
  fonts: FontOption[];
  blobEnabled: boolean;
}) {
  const router = useRouter();
  const state = useBuilderState(initialLayout);
  const [side, setSide] = useState<SidePanel>("design");
  const [showGuides, setShowGuides] = useState(true);
  const [activeVariantId, setActiveVariantId] = useState(
    () => (variants.find((v) => v.isDefault) ?? variants[0])?.id ?? "",
  );
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);

  const activeVariant = variants.find((v) => v.id === activeVariantId) ?? variants[0];
  const assetMap = useMemo(
    () => buildAssetMap(assets, activeVariant?.id ?? null),
    [assets, activeVariant?.id],
  );
  const content = useMemo(() => resolveContent(SAMPLE_CONTENT_INPUT), []);

  const save = useCallback(() => {
    setSaveError(null);
    startSaving(async () => {
      const result = await saveLayoutAction(themeId, state.doc);
      if (result?.error) {
        setSaveError(result.error);
        return;
      }
      state.markSaved(state.doc);
      router.refresh();
    });
  }, [themeId, state, router]);

  // Ctrl/Cmd+S saves, Ctrl/Cmd+Z undoes — muscle memory in a canvas editor.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "s") {
        event.preventDefault();
        save();
      } else if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        state.undo();
      } else if ((event.key === "z" && event.shiftKey) || event.key === "y") {
        event.preventDefault();
        state.redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save, state]);

  // Leaving with unsaved layout changes loses real work — the document only
  // lives in this component's state until an explicit save.
  useEffect(() => {
    if (!state.dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty]);

  function addLayer(type: LayerType, slot?: string) {
    state.addLayer(createLayer(type, state.scene, state.nextZ(state.scene), slot));
  }

  /**
   * The starter set is written straight to the database by the server action,
   * so the editor's in-memory document knows nothing about it — and
   * `router.refresh()` only re-runs the server component, while
   * `useBuilderState` keeps the copy it was seeded with. A full page load is
   * the honest way to re-seed it, and it is safe here because the button only
   * shows on an empty canvas.
   */
  function applyStarterLayout() {
    setSaveError(null);
    startSaving(async () => {
      const result = await applyStarterLayoutAction(themeId, locale);
      if (result?.error) {
        setSaveError(result.error);
        return;
      }
      // Adopt the saved document in place. The server validated it on the way
      // out, so parsing it back is a formality that also keeps the editor's
      // state the same shape it would have had on a fresh load.
      state.markSaved(parseLayoutDoc(result.doc));
      router.refresh();
    });
  }

  const errorCount = issues?.filter((i) => i.level === "error").length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
        <div className="flex rounded-lg border border-border p-0.5">
          {SCENE_IDS.map((scene) => (
            <button
              key={scene}
              type="button"
              onClick={() => {
                state.setScene(scene);
                state.setSelectedId(null);
              }}
              className={`rounded-md px-2.5 py-1 text-xs ${
                state.scene === scene ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {SCENE_LABELS[scene]}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-border p-0.5">
          {(Object.keys(DEVICE_PRESETS) as Breakpoint[]).map((bp) => (
            <button
              key={bp}
              type="button"
              onClick={() => state.setBreakpoint(bp)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                state.breakpoint === bp ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {DEVICE_PRESETS[bp].labelAr}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {ADD_BUTTONS.map((button) => (
            <GhostButton key={button.type} onClick={() => addLayer(button.type)}>
              {button.label}
            </GhostButton>
          ))}
          <AddImageMenu onAdd={(slot) => addLayer("asset", slot)} />
          {state.doc.layers.length === 0 && (
            <GhostButton
              title="يضيف الظرف والبطاقة والنصوص الأساسية في أماكنها"
              disabled={saving}
              onClick={applyStarterLayout}
            >
              أضف العناصر الأساسية
            </GhostButton>
          )}
        </div>

        <div className="flex items-center gap-1">
          <GhostButton title="تراجع" disabled={!state.canUndo} onClick={state.undo}>
            ↶
          </GhostButton>
          <GhostButton title="إعادة" disabled={!state.canRedo} onClick={state.redo}>
            ↷
          </GhostButton>
          <GhostButton onClick={() => setShowGuides((v) => !v)}>
            {showGuides ? "إخفاء المساطر" : "إظهار المساطر"}
          </GhostButton>
        </div>

        <div className="ms-auto flex items-center gap-2">
          {state.dirty && <span className="text-xs text-warning">تغييرات غير محفوظة</span>}
          <a
            href={`/theme-preview/${themeId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border px-3 py-1.5 text-xs text-fg hover:border-accent"
          >
            معاينة الدعوة
          </a>
          <button
            type="button"
            onClick={save}
            disabled={saving || !state.dirty}
            className="h-9 rounded-full bg-accent px-4 text-xs font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
          >
            {saving ? "جاري الحفظ…" : "حفظ"}
          </button>
          <button
            type="button"
            onClick={() =>
              startSaving(async () => {
                const found = await checkBuilderThemeAction(themeId);
                setIssues(found);
                if (found.some((i) => i.level === "error")) return;
                const result = await publishBuilderThemeAction(themeId, locale);
                if (result?.error) setSaveError(result.error);
                else router.refresh();
              })
            }
            disabled={saving}
            className="h-9 rounded-full border border-accent px-4 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {themeStatus === "PUBLISHED" ? "إعادة الفحص" : "نشر"}
          </button>
        </div>
      </div>

      {saveError && <p className="rounded-lg bg-danger/10 p-2 text-xs whitespace-pre-line text-danger">{saveError}</p>}

      {issues && (
        <div className="rounded-xl border border-border bg-surface p-3">
          <h3 className="mb-1 text-sm font-medium text-fg">
            {issues.length === 0
              ? "الفحص تمام — التصميم جاهز للنشر ✓"
              : errorCount > 0
                ? `${errorCount} مشكلة تمنع النشر`
                : "تنبيهات (ما تمنع النشر)"}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {issues.map((issue, index) => (
              <li
                key={index}
                className={`text-xs ${issue.level === "error" ? "text-danger" : "text-warning"}`}
              >
                {issue.level === "error" ? "✕" : "⚠"} {issue.messageAr}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setIssues(null)} className="mt-2 text-[11px] text-fg-muted hover:underline">
            إخفاء
          </button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="overflow-auto rounded-xl border border-border bg-surface-2 p-4">
          {activeVariant ? (
            <BuilderCanvas
              layout={state.doc}
              typography={typography}
              palette={activeVariant.palette}
              assets={assetMap}
              content={content}
              scene={state.scene}
              breakpoint={state.breakpoint}
              selectedId={state.selectedId}
              showGuides={showGuides}
              deviceWidth={DEVICE_PRESETS[state.breakpoint].width}
              deviceHeight={DEVICE_PRESETS[state.breakpoint].height}
              onSelect={state.setSelectedId}
              onBeginInteraction={state.beginInteraction}
              onTransform={(id, patch) => state.patchTransform(id, patch, { history: false })}
            />
          ) : (
            <p className="text-sm text-fg-muted">أضف لونًا واحدًا على الأقل للتصميم.</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex rounded-lg border border-border p-0.5">
            {SIDE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSide(tab.id)}
                className={`flex-1 rounded-md px-2 py-1 text-xs ${
                  side === tab.id ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {side === "design" && (
            <>
              <LayersPanel
                doc={state.doc}
                scene={state.scene}
                selectedId={state.selectedId}
                onSelect={state.setSelectedId}
                onMove={state.moveLayer}
                onPatch={state.patchLayer}
                onRemove={state.removeLayer}
              />
              <InspectorPanel
                layer={state.selected}
                breakpoint={state.breakpoint}
                typography={typography}
                fonts={fonts}
                onTransform={(patch) => state.selected && state.patchTransform(state.selected.id, patch)}
                onPatch={(patch) => state.selected && state.patchLayer(state.selected.id, patch)}
                onTextStyle={(patch) => state.selected && state.patchTextStyle(state.selected.id, patch)}
                onClearOverrides={() => state.selected && state.clearOverrides(state.selected.id)}
              />
            </>
          )}

          {side === "assets" && activeVariant && (
            <AssetsPanel
              themeId={themeId}
              variantId={activeVariant.id}
              variantName={activeVariant.nameAr}
              assets={assets}
              blobEnabled={blobEnabled}
              locale={locale}
              onUploaded={() => router.refresh()}
            />
          )}

          {side === "colors" && (
            <VariantsPanel
              themeId={themeId}
              locale={locale}
              variants={variants}
              activeId={activeVariantId}
              onSelect={setActiveVariantId}
            />
          )}

          {side === "settings" && (
            <SettingsPanel
              doc={state.doc}
              scene={state.scene}
              onScene={state.patchScene}
              onAnimation={state.patchAnimation}
              onPage={state.patchPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AddImageMenu({ onAdd }: { onAdd: (slot: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <GhostButton onClick={() => setOpen((v) => !v)}>+ صورة</GhostButton>
      {open && (
        <div className="absolute z-50 mt-1 flex w-44 flex-col rounded-lg border border-border bg-surface p-1 shadow-lg">
          {CORE_SLOTS.map((slot) => (
            <button
              key={slot.key}
              type="button"
              onClick={() => {
                onAdd(slot.key);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-start text-xs text-fg hover:bg-surface-2"
            >
              {slot.labelAr}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onAdd("decoration");
              setOpen(false);
            }}
            className="rounded-md px-2 py-1 text-start text-xs text-fg-muted hover:bg-surface-2"
          >
            عنصر آخر…
          </button>
        </div>
      )}
    </div>
  );
}
