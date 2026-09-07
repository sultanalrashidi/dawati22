"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BuilderCanvas } from "@/components/admin/builder/builder-canvas";
import { AssetsPanel, type AssetRow } from "@/components/admin/builder/assets-panel";
import { InspectorPanel } from "@/components/admin/builder/inspector-panel";
import { LayersPanel } from "@/components/admin/builder/layers-panel";
import { ScenesPanel } from "@/components/admin/builder/scenes-panel";
import { VariantsPanel, type VariantRow } from "@/components/admin/builder/variants-panel";
import { SettingsPanel } from "@/components/admin/builder/settings-panel";
import { GhostButton } from "@/components/admin/builder/builder-ui";
import { RibbonGreetingPreset } from "@/components/admin/builder/ribbon-greeting-preset";
import { createLayer } from "@/components/admin/builder/layer-factory";
import {
  arabicNumber,
  useBuilderState,
  type VariantGeometry,
  type VariantPaint,
} from "@/components/admin/builder/use-builder-state";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";
import { CORE_SLOTS } from "@/lib/themes/builder/slots";
import { buildAssetMap } from "@/lib/themes/builder/resolve";
import { resolveContent, SAMPLE_CONTENT_INPUT, type InvitationContentInput } from "@/lib/themes/builder/content";
import { assertLayoutDoc, assertLayoutOverrides, parseLayoutDoc } from "@/lib/themes/builder/schema";
import {
  DEFAULT_PALETTE,
  DEVICE_PRESETS,
  type Breakpoint,
  type LayerType,
  type LayoutDoc,
  type TypographyDoc,
} from "@/lib/themes/builder/types";
import type { FontOption } from "@/lib/themes/font-registry";
import {
  applyStarterLayoutAction,
  checkBuilderThemeAction,
  publishBuilderThemeAction,
  saveLayoutAction,
  saveVariantOverridesAction,
} from "@/lib/admin/themes/builder-actions";
import type { ValidationIssue } from "@/lib/admin/themes/builder-service";

/** The colour half of a variant's stored overrides, ready for the editor. */
function paintOf(variant: VariantRow | undefined): VariantPaint {
  const out: VariantPaint = {};
  for (const [layerId, override] of Object.entries(variant?.overrides ?? {})) {
    if (override?.paint) out[layerId] = override.paint;
  }
  return out;
}

/**
 * Writes the edited colours back beside the geometry overrides already stored
 * for this variant, so saving a colour never drops a position the legacy
 * importer put there.
 */
function mergeOverrides(
  stored: LayoutOverrides,
  paint: VariantPaint,
  geometry: VariantGeometry,
): LayoutOverrides {
  const out: LayoutOverrides = { ...stored };
  const ids = new Set([...Object.keys(stored), ...Object.keys(paint), ...Object.keys(geometry)]);
  for (const layerId of ids) {
    // Whatever the editor is holding for this layer wins; a layer it never
    // touched keeps what was stored, so saving a colour cannot drop a position
    // the legacy importer put there.
    const geo = geometry[layerId] ?? stripPaint(stored[layerId]);
    const colours = paint[layerId];
    const next =
      colours && Object.keys(colours).length > 0 ? { ...geo, paint: colours } : { ...geo };
    if (Object.keys(next).length === 0) delete out[layerId];
    else out[layerId] = next;
  }
  return out;
}

/** A stored override with its colours removed — the geometry half. */
function stripPaint(override: LayoutOverrides[string]): Record<string, unknown> {
  if (!override) return {};
  const { paint: _paint, ...geometry } = override;
  return geometry;
}

/** Every layer's geometry override for one colour, as the editor holds it. */
function geometryOf(variant: VariantRow | undefined): VariantGeometry {
  const out: VariantGeometry = {};
  for (const [layerId, override] of Object.entries(variant?.overrides ?? {})) {
    const geometry = stripPaint(override);
    if (Object.keys(geometry).length > 0) out[layerId] = geometry as VariantGeometry[string];
  }
  return out;
}

const ADD_BUTTONS: { type: LayerType; label: string }[] = [
  { type: "text", label: "+ نص" },
  { type: "seal", label: "+ ختم" },
  { type: "qr", label: "+ باركود" },
];

/**
 * The interactive blocks. They live behind a menu rather than the toolbar's
 * quick buttons: each is added once per design at most, so eight side-by-side
 * buttons would cost more room than they earn.
 */
const ADD_BLOCKS: { type: LayerType; label: string }[] = [
  { type: "countdown", label: "عد تنازلي" },
  { type: "button", label: "زر (تقويم / خريطة / رابط)" },
  { type: "rsvp", label: "نموذج تأكيد الحضور" },
  { type: "schedule", label: "برنامج الحفل" },
  { type: "notes", label: "ملاحظات" },
];

type SidePanel = "design" | "scenes" | "assets" | "colors" | "settings";

const SIDE_TABS: { id: SidePanel; label: string }[] = [
  { id: "design", label: "التصميم" },
  { id: "scenes", label: "الشاشات" },
  { id: "assets", label: "الصور" },
  { id: "colors", label: "الألوان" },
  { id: "settings", label: "الإعدادات" },
];

export function ThemeBuilder({
  themeId,
  themeSlug = "",
  themeStatus,
  locale,
  initialLayout,
  typography,
  variants,
  assets,
  fonts,
  blobEnabled,
  localPreview,
}: {
  themeId: string;
  themeSlug?: string;
  themeStatus: string;
  locale: string;
  initialLayout: LayoutDoc;
  typography: TypographyDoc;
  variants: VariantRow[];
  assets: AssetRow[];
  fonts: FontOption[];
  blobEnabled: boolean;
  /** Snapshot-only QA: never mount server-writing panels or invoke actions. */
  localPreview?: { width: number; height: number; content: InvitationContentInput };
}) {
  const router = useRouter();
  const initialVariant = variants.find((v) => v.isDefault) ?? variants[0];
  const state = useBuilderState(initialLayout, paintOf(initialVariant), geometryOf(initialVariant), localPreview ? "greeting" : undefined);
  const [side, setSide] = useState<SidePanel>("design");
  const [showGuides, setShowGuides] = useState(!localPreview);
  const [previewOverrides, setPreviewOverrides] = useState<Record<string, LayoutOverrides>>({});
  const [previewSaved, setPreviewSaved] = useState<string | null>(null);
  const [activeVariantId, setActiveVariantId] = useState(
    () => (variants.find((v) => v.isDefault) ?? variants[0])?.id ?? "",
  );
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);

  const activeVariant = variants.find((v) => v.id === activeVariantId) ?? variants[0];

  /**
   * Colours belong to the variant, so switching colour swaps the whole set —
   * and unsaved colour edits on the previous one would be lost, which is why
   * `selectVariant` saves them first.
   */
  const { replacePaint, replaceVariantGeometry, paintDirty, paint, variantGeometry, markPaintSaved } = state;

  // A save captures the document and this colour's record in its closure,
  // then awaits a round trip. Anything edited meanwhile is not in what was
  // written, so a continuation must compare against what the editor holds
  // NOW before it declares the editor clean. Identity is enough: every
  // setter in the state hook creates a new object.
  const latest = useRef({ doc: state.doc, paint, variantGeometry });
  useEffect(() => {
    latest.current = { doc: state.doc, paint, variantGeometry };
  });
  const paintUnchangedSince = (snapshot: { paint: VariantPaint; variantGeometry: VariantGeometry }) =>
    latest.current.paint === snapshot.paint && latest.current.variantGeometry === snapshot.variantGeometry;

  const selectVariant = useCallback(
    (id: string) => {
      // While a save (and the refresh it ends with) is in flight, `variants`
      // still holds the pre-save rows: switching back to the colour just
      // saved would re-seed the editor from them, and the next save would
      // write the old colours over the new ones. Wait for the refresh.
      if (saving || id === activeVariantId) return;
      const next = variants.find((v) => v.id === id);
      if (localPreview) {
        // Keep test edits only in memory, including colour switches. Never
        // reach the production editor's autosave branch from this fixture.
        if (activeVariant) setPreviewOverrides((current) => ({ ...current,
          [activeVariant.id]: mergeOverrides(activeVariant.overrides, paint, variantGeometry) }));
        const stored = next && { ...next, overrides: previewOverrides[id] ?? next.overrides };
        setActiveVariantId(id);
        replacePaint(paintOf(stored));
        replaceVariantGeometry(geometryOf(stored));
        return;
      }
      const switchTo = () => {
        setActiveVariantId(id);
        replacePaint(paintOf(next));
        // Positions are per-colour too now, so they swap with the colour or
        // the editor would show one colour's nudges on another.
        replaceVariantGeometry(geometryOf(next));
      };
      if (!paintDirty || !activeVariant) {
        switchTo();
        return;
      }
      // This colour's unsaved edits would be replaced by the next colour's
      // record; write them first, and stay here if that fails.
      setSaveError(null);
      const snapshot = { paint, variantGeometry };
      startSaving(async () => {
        const merged = mergeOverrides(activeVariant.overrides, paint, variantGeometry);
        const result = await saveVariantOverridesAction(activeVariant.id, merged);
        if (result?.error) {
          setSaveError(result.error);
          return;
        }
        router.refresh();
        // Edits made while the save was in flight are not in `merged`: stay
        // on this colour with them still marked unsaved, so the next switch
        // writes them too instead of replacing them with the other colour's.
        if (!paintUnchangedSince(snapshot)) return;
        markPaintSaved();
        switchTo();
      });
    },
    [saving, activeVariantId, activeVariant, variants, replacePaint, replaceVariantGeometry, paintDirty, paint, variantGeometry, markPaintSaved, router, localPreview, previewOverrides],
  );
  /**
   * A colour edit does not touch the layout document, so the document's own
   * dirty flag stays false — gating Save on it alone would leave the button
   * disabled and make a recoloured variant impossible to save.
   */
  const unsaved = state.dirty || state.paintDirty;

  const paintedDoc = useMemo(
    () => ({ ...state.doc, layers: state.paintedLayers }),
    [state.doc, state.paintedLayers],
  );

  const assetMap = useMemo(
    () => buildAssetMap(assets, activeVariant?.id ?? null),
    [assets, activeVariant?.id],
  );
  const content = useMemo(() => resolveContent(localPreview?.content ?? SAMPLE_CONTENT_INPUT), [localPreview?.content]);

  const save = useCallback(() => {
    if (saving) return;
    setSaveError(null);
    const snapshot = { doc: state.doc, paint: state.paint, variantGeometry: state.variantGeometry };
    if (localPreview) {
      // Exercise the same document validation/serialization as saveLayoutDoc,
      // but deliberately do not call it or any database-backed action.
      const layout = assertLayoutDoc(JSON.parse(JSON.stringify(snapshot.doc)));
      const overrides = { ...previewOverrides, ...(activeVariant ? {
        [activeVariant.id]: mergeOverrides(activeVariant.overrides, snapshot.paint, snapshot.variantGeometry),
      } : {}) };
      for (const value of Object.values(overrides)) assertLayoutOverrides(value);
      setPreviewSaved(JSON.stringify({ layout, overrides }));
      setPreviewOverrides(overrides);
      state.markSaved(layout);
      state.markPaintSaved();
      return;
    }
    startSaving(async () => {
      const result = await saveLayoutAction(themeId, snapshot.doc);
      if (result?.error) {
        setSaveError(result.error);
        return;
      }
      // The design and this colour's own colours are two records; both have to
      // land before the editor calls itself saved.
      if (state.paintDirty && activeVariant) {
        const merged = mergeOverrides(activeVariant.overrides, snapshot.paint, snapshot.variantGeometry);
        const painted = await saveVariantOverridesAction(activeVariant.id, merged);
        if (painted?.error) {
          setSaveError(painted.error);
          return;
        }
        // Only what was written is saved; a colour edit made during the round
        // trip stays flagged so the next save carries it.
        if (paintUnchangedSince(snapshot)) state.markPaintSaved();
      }
      // Likewise for the design: marking a newer document as saved would
      // silently revert the edits made while this one was being written.
      if (latest.current.doc === snapshot.doc) state.markSaved(snapshot.doc);
      router.refresh();
    });
  }, [saving, themeId, state, router, activeVariant, localPreview, previewOverrides]);

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
    if (!unsaved || localPreview) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved, localPreview]);

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
    if (localPreview) return;
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
      {localPreview && <div className="rounded-xl border border-border p-3 text-sm">
        <p>محرر محلي ببيانات توضيحية — الحفظ والتبديل هنا في الذاكرة فقط، ولا يصلان إلى قاعدة البيانات.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {variants.map((variant) => <button key={variant.id} type="button" aria-pressed={activeVariantId === variant.id}
            className="rounded-full border px-3 py-2" onClick={() => selectVariant(variant.id)}>{variant.nameAr}</button>)}
          <button type="button" className="rounded-full border px-3 py-2" onClick={save}>حفظ نسخة محلية</button>
          <button type="button" className="rounded-full border px-3 py-2 disabled:opacity-40" disabled={!previewSaved}
            onClick={() => {
              if (!previewSaved) return;
              const saved = JSON.parse(previewSaved) as { layout: LayoutDoc; overrides: Record<string, LayoutOverrides> };
              for (const value of Object.values(saved.overrides)) assertLayoutOverrides(value);
              state.markSaved(parseLayoutDoc(assertLayoutDoc(saved.layout)));
              setPreviewOverrides(saved.overrides);
              const stored = activeVariant && { ...activeVariant, overrides: saved.overrides[activeVariantId] ?? activeVariant.overrides };
              replacePaint(paintOf(stored)); replaceVariantGeometry(geometryOf(stored));
            }}>إعادة تحميل النسخة المحلية</button>
        </div>
        {previewSaved && <p role="status">تم حفظ نسخة في الذاكرة والتحقق من مخططها، وليست في قاعدة البيانات.</p>}
        <output hidden data-preview-layout>{JSON.stringify(state.doc)}</output>
      </div>}
      {state.scene === "greeting" && <RibbonGreetingPreset themeSlug={themeSlug} layout={state.doc}
        overrides={[...variants.map((variant) => localPreview ? previewOverrides[variant.id] ?? variant.overrides : variant.overrides), state.variantOverrides]}
        published={!localPreview && themeStatus === "PUBLISHED"} disabled={saving}
        onApply={(layout) => { state.applyDocument(layout); state.setTransformScope("all"); state.setSelectedId(null); }} />}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
        {/* Scene tabs, in the order the guest scrolls through them. */}
        <div className="flex max-w-full flex-wrap rounded-lg border border-border p-0.5">
          {state.doc.scenes.map((scene, index) => (
            <button
              key={scene.id}
              type="button"
              title={scene.visible ? scene.name : `${scene.name} — مخفية عن المدعو`}
              onClick={() => {
                state.setScene(scene.id);
                state.setSelectedId(null);
              }}
              className={`rounded-md px-2.5 py-1 text-xs ${
                state.scene === scene.id
                  ? "bg-accent text-accent-fg"
                  : scene.visible
                    ? "text-fg-muted hover:text-fg"
                    : "text-fg-muted/50 line-through hover:text-fg"
              }`}
            >
              {arabicNumber(index + 1)} · {scene.name}
            </button>
          ))}
        </div>
        <GhostButton title="إضافة وترتيب وحذف الشاشات" onClick={() => setSide("scenes")}>
          ⚙ الشاشات
        </GhostButton>

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
          <AddMenu label="+ مكوّن" items={ADD_BLOCKS} onAdd={(type) => addLayer(type)} />
          {!localPreview && state.doc.layers.length === 0 && (
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

          {/*
            Where a move lands. Sits in the toolbar rather than the inspector
            because it governs dragging on the canvas, and an admin who has just
            been surprised by it needs to find it without hunting.
          */}
          {variants.length > 1 && (
            <div className="ms-2 flex items-center gap-1 rounded-full border border-border p-0.5">
              {(
                [
                  ["all", "كل الألوان"],
                  ["variant", "هذا اللون فقط"],
                ] as const
              ).map(([scope, label]) => (
                <button
                  key={scope}
                  type="button"
                  aria-pressed={state.transformScope === scope}
                  onClick={() => state.setTransformScope(scope)}
                  title="يحدد إذا كان تحريك العنصر يغيّر كل ألوان التصميم أو هذا اللون وحده"
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    state.transformScope === scope
                      ? "bg-accent font-medium text-accent-fg"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!localPreview && <div className="ms-auto flex items-center gap-2">
          {unsaved && <span className="text-xs text-warning">تغييرات غير محفوظة</span>}
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
            disabled={saving || !unsaved}
            className="h-9 rounded-full bg-accent px-4 text-xs font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
          >
            {saving ? "جاري الحفظ…" : "حفظ"}
          </button>
          <button
            type="button"
            onClick={() =>
              startSaving(async () => {
                if (localPreview) return;
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
        </div>}
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
        <div data-builder-preview className="overflow-auto rounded-xl border border-border bg-surface-2 p-4">
          {activeVariant ? (
            <BuilderCanvas
              // The variant's own colours merged in, so the stage shows the
              // colour the admin picked rather than the shared design's.
              layout={paintedDoc}
              // What this colour changes about the shared layout. Passing it
              // is what makes the canvas show the colour a guest would get —
              // without it a variant's own positions were invisible here.
              overrides={state.variantOverrides}
              typography={typography}
              palette={activeVariant.palette}
              assets={assetMap}
              content={content}
              scene={state.scene}
              breakpoint={state.breakpoint}
              selectedId={state.selectedId}
              showGuides={showGuides}
              deviceWidth={state.breakpoint === "base" && localPreview ? localPreview.width : DEVICE_PRESETS[state.breakpoint].width}
              deviceHeight={state.breakpoint === "base" && localPreview ? localPreview.height : DEVICE_PRESETS[state.breakpoint].height}
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
            {SIDE_TABS.filter((tab) => !localPreview || (tab.id !== "assets" && tab.id !== "colors")).map((tab) => (
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
                // The colour chips show THIS colour's palette, so the swatch
                // beside "النص" is the ink the stage is painting right now.
                palette={activeVariant?.palette ?? DEFAULT_PALETTE}
                fonts={fonts}
                onTransform={(patch) => state.selected && state.patchTransform(state.selected.id, patch)}
                onPatch={(patch) => state.selected && state.patchLayer(state.selected.id, patch)}
                onTextStyle={(patch) => state.selected && state.patchTextStyle(state.selected.id, patch)}
                onClearOverrides={() => state.selected && state.clearOverrides(state.selected.id)}
              />
            </>
          )}

          {side === "scenes" && (
            <ScenesPanel
              doc={state.doc}
              activeScene={state.scene}
              onSelect={(id) => {
                state.setScene(id);
                state.setSelectedId(null);
              }}
              onAdd={state.addScene}
              onPatch={state.patchSceneDef}
              onMove={state.moveScene}
              onRemove={state.removeScene}
              layerCount={state.sceneLayerCount}
            />
          )}

          {!localPreview && side === "assets" && activeVariant && (
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

          {!localPreview && side === "colors" && (
            <VariantsPanel
              switching={saving}
              themeId={themeId}
              locale={locale}
              variants={variants}
              activeId={activeVariantId}
              onSelect={selectVariant}
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

function AddMenu({
  label,
  items,
  onAdd,
}: {
  label: string;
  items: { type: LayerType; label: string }[];
  onAdd: (type: LayerType) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <GhostButton onClick={() => setOpen((v) => !v)}>{label}</GhostButton>
      {open && (
        <div className="absolute z-50 mt-1 flex w-56 flex-col rounded-lg border border-border bg-surface p-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => {
                onAdd(item.type);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-start text-xs text-fg hover:bg-surface-2"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
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
