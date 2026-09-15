"use client";

import { useState } from "react";
import { GhostButton, Panel, SelectField, TextField } from "@/components/admin/builder/builder-ui";
import { arabicNumber, type SceneDefPatch } from "@/components/admin/builder/use-builder-state";
import {
  SCENE_REQUIREMENTS,
  type LayoutDoc,
  type SceneId,
  type SceneRequirement,
  type SceneRole,
} from "@/lib/themes/builder/types";

/**
 * The scene manager.
 *
 * Scenes are the screens the guest scrolls through, in this exact order. The
 * panel is deliberately the only place they can be added or removed, because
 * three of the guard rails the guest flow relies on — one cover, at most one
 * of each pass, and layers dying with their scene — are easiest to keep honest
 * when every change goes through one form. (The no-barcode pass is the one
 * exception: it is created from the toolbar, as a copy of the pass.)
 */

const ROLE_LABELS: Record<SceneRole, string> = {
  cover: "الغلاف — شاشة الفتح",
  flow: "شاشة عادية",
  pass: "بطاقة الدخول",
  passNoQr: "بطاقة الدخول — بدون باركود",
};

const PASS_HINT = "بطاقة الدخول ما تظهر إلا للمدعو اللي أكد حضوره، وشاشة وحدة بس تقدر تكون بطاقة.";

/** Under the kind picker. A plain screen gets the pass line, as the choice it can make. */
const ROLE_HINTS: Record<SceneRole, string> = {
  cover: "لتغيير الغلاف: اختر شاشة ثانية وخلّ نوعها «الغلاف» — وهذي بتصير شاشة عادية تلقائيًا.",
  flow: PASS_HINT,
  pass: PASS_HINT,
  passNoQr:
    "تظهر بدل «بطاقة الدخول» في الدعوات اللي انباعت بدون باركود، للمدعو اللي أكد حضوره. لو أخفيتها أو حذفتها ترجع هذي الدعوات تعرض «بطاقة الدخول» نفسها بدون الباركود.",
};

const REQUIREMENT_LABELS: Record<SceneRequirement, string> = {
  schedule: "برنامج المناسبة",
  notes: "الملاحظات",
  map: "الخريطة",
  music: "الموسيقى",
};

/** `null` has no representation in a `<select>` value. */
const ALWAYS = "";

export function ScenesPanel({
  doc,
  activeScene,
  onSelect,
  onAdd,
  onPatch,
  onMove,
  onRemove,
  layerCount,
}: {
  doc: LayoutDoc;
  activeScene: SceneId;
  onSelect: (id: SceneId) => void;
  onAdd: () => void;
  onPatch: (id: SceneId, patch: SceneDefPatch) => void;
  onMove: (id: SceneId, direction: -1 | 1) => void;
  onRemove: (id: SceneId) => void;
  /** Layers that would be deleted with the scene. */
  layerCount: (id: SceneId) => number;
}) {
  const [confirming, setConfirming] = useState<SceneId | null>(null);
  const scenes = doc.scenes;
  const atLimit = scenes.length >= 30;

  return (
    <Panel
      title="الشاشات"
      action={
        <GhostButton
          title={atLimit ? "وصلت الحد الأقصى للشاشات" : "يضيف شاشة جديدة قبل بطاقة الدخول"}
          disabled={atLimit}
          // Wrapped, not passed straight through: `GhostButton` wires `onClick`
          // to the DOM handler, so a bare reference is called with the click
          // event — which `addScene` would take for the new scene's name.
          onClick={() => onAdd()}
        >
          + شاشة
        </GhostButton>
      }
    >
      <p className="mb-2 text-[11px] text-fg-muted">
        الترتيب هنا هو ترتيب تصفّح المدعو للدعوة. اضغط على الشاشة عشان تحررها وتظهر في المحرر.
      </p>

      <ul className="flex flex-col gap-1.5">
        {scenes.map((scene, index) => {
          const active = scene.id === activeScene;
          const isCover = scene.role === "cover";
          const count = layerCount(scene.id);
          // The cover is the tap-to-open screen: without one the invitation
          // never opens, so it can only be replaced, never removed.
          const deleteBlockedReason = isCover
            ? "ما يمكن حذف الغلاف — خلّ شاشة ثانية غلافًا أول وبعدها احذف هذي"
            : scenes.length <= 1
              ? "لازم يبقى في شاشة وحدة على الأقل"
              : null;

          if (confirming === scene.id) {
            return (
              <li key={scene.id} className="rounded-xl border border-danger/50 bg-danger/5 p-2">
                <p className="text-xs text-fg">
                  حذف «{scene.name}»؟{" "}
                  {count > 0 ? (
                    <b className="text-danger">
                      بينحذف معها {arabicNumber(count)} {count === 1 ? "عنصر" : "عناصر"} من التصميم.
                    </b>
                  ) : (
                    <span className="text-fg-muted">ما فيها أي عنصر.</span>
                  )}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <GhostButton
                    danger
                    onClick={() => {
                      onRemove(scene.id);
                      setConfirming(null);
                    }}
                  >
                    احذف الشاشة
                  </GhostButton>
                  <GhostButton onClick={() => setConfirming(null)}>إلغاء</GhostButton>
                </div>
              </li>
            );
          }

          return (
            <li
              key={scene.id}
              className={`rounded-xl border p-2 ${active ? "border-accent bg-accent/5" : "border-border"}`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelect(scene.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-start"
                >
                  <span className="w-4 shrink-0 text-center text-[11px] text-fg-muted">
                    {arabicNumber(index + 1)}
                  </span>
                  <span className={`truncate text-xs ${scene.visible ? "text-fg" : "text-fg-muted line-through"}`}>
                    {scene.name}
                  </span>
                  {!isCover && scene.role === "pass" && (
                    <span className="shrink-0 rounded-full border border-border px-1.5 text-[10px] text-fg-muted">
                      بطاقة
                    </span>
                  )}
                  {scene.role === "passNoQr" && (
                    <span className="shrink-0 rounded-full border border-border px-1.5 text-[10px] text-fg-muted">
                      بدون باركود
                    </span>
                  )}
                  {isCover && (
                    <span className="shrink-0 rounded-full border border-border px-1.5 text-[10px] text-fg-muted">
                      غلاف
                    </span>
                  )}
                  {scene.requires && (
                    <span className="shrink-0 rounded-full border border-border px-1.5 text-[10px] text-fg-muted">
                      {REQUIREMENT_LABELS[scene.requires]}
                    </span>
                  )}
                </button>

                {/* Only flow scenes move, and only past other flow scenes:
                    the cover and the entry pass are the fixed ends of the
                    guest's journey. */}
                <GhostButton
                  title="للأعلى"
                  disabled={scene.role !== "flow" || scenes[index - 1]?.role !== "flow"}
                  onClick={() => onMove(scene.id, -1)}
                >
                  ↑
                </GhostButton>
                <GhostButton
                  title="للأسفل"
                  disabled={scene.role !== "flow" || scenes[index + 1]?.role !== "flow"}
                  onClick={() => onMove(scene.id, 1)}
                >
                  ↓
                </GhostButton>
                <GhostButton
                  title={deleteBlockedReason ?? `حذف الشاشة و${arabicNumber(count)} من عناصرها`}
                  danger
                  disabled={deleteBlockedReason !== null}
                  onClick={() => setConfirming(scene.id)}
                >
                  ✕
                </GhostButton>
              </div>

              {active && (
                <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
                  <TextField
                    label="اسم الشاشة"
                    dir="rtl"
                    value={scene.name}
                    // An empty name fails `sceneDefSchema.name.min(1)` and makes the WHOLE
                // document unsavable with a raw zod message, so mid-edit blanks
                // fall back to the scene's id rather than being stored empty.
                onChange={(name) => onPatch(scene.id, { name: name.trim() === "" ? scene.id : name })}
                  />

                  <SelectField
                    label="نوع الشاشة"
                    value={scene.role}
                    // The cover offers no alternative on purpose: demoting the
                    // only cover would leave the invitation with no screen to
                    // tap. Promoting another scene demotes this one instead.
                    options={
                      isCover
                        ? [{ value: "cover" as SceneRole, label: ROLE_LABELS.cover }]
                        : (["cover", "flow", "pass", "passNoQr"] as SceneRole[]).map((role) => ({
                            value: role,
                            label: ROLE_LABELS[role],
                          }))
                    }
                    onChange={(role) => onPatch(scene.id, { role })}
                  />
                  <p className="-mt-1 text-[11px] text-fg-muted">{ROLE_HINTS[scene.role]}</p>

                  <SelectField
                    label="متى تظهر"
                    value={scene.requires ?? ALWAYS}
                    options={[
                      { value: ALWAYS, label: "دائمًا" },
                      ...SCENE_REQUIREMENTS.map((requirement) => ({
                        value: requirement as string,
                        label: `فقط إذا كان في المناسبة: ${REQUIREMENT_LABELS[requirement]}`,
                      })),
                    ]}
                    onChange={(value) =>
                      onPatch(scene.id, {
                        requires: value === ALWAYS ? null : (value as SceneRequirement),
                      })
                    }
                  />

                  <label
                    className={`flex items-center gap-2 text-xs ${isCover ? "text-fg-muted" : "cursor-pointer text-fg"}`}
                    title={isCover ? "الغلاف لازم يظهر — بدونه ما تنفتح الدعوة" : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={scene.visible}
                      disabled={isCover}
                      onChange={(event) => onPatch(scene.id, { visible: event.target.checked })}
                      className="h-4 w-4 accent-[var(--color-accent)] disabled:opacity-40"
                    />
                    تظهر للمدعو
                  </label>
                  <p className="-mt-1 text-[11px] text-fg-muted">
                    إخفاء الشاشة يخليها تختفي من الدعوة بدون ما تنحذف عناصرها — تقدر ترجعها أي وقت.
                  </p>

                  <p className="text-[11px] text-fg-muted">
                    فيها {arabicNumber(count)} {count === 1 ? "عنصر" : "عناصر"}.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
