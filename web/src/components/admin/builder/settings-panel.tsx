"use client";

import { ColorField, NumberField, Panel, SelectField } from "@/components/admin/builder/builder-ui";
import { ALL_SLOTS } from "@/lib/themes/builder/slots";
import {
  CARD_ENTRANCES,
  ENVELOPE_ENTRANCES,
  ENVELOPE_OPENINGS,
  findScene,
  sceneCanvas,
  type AnimationSettings,
  type LayoutDoc,
  type PageBackground,
  type SceneCanvas,
  type SceneId,
} from "@/lib/themes/builder/types";

const ENTRANCE_LABELS: Record<string, string> = {
  none: "بدون",
  fade: "تلاشي",
  slide: "انزلاق",
  scale: "تكبير",
  "slide-up": "انزلاق للأعلى",
  normal: "عادي",
  slow: "بطيء",
  elegant: "أنيق",
};

/** `null` has no representation in a `<select>` value, so "no background" is "". */
const NO_SLOT = "";

export function SettingsPanel({
  doc,
  scene,
  onScene,
  onAnimation,
  onPage,
}: {
  doc: LayoutDoc;
  scene: SceneId;
  onScene: (scene: SceneId, patch: Partial<SceneCanvas>) => void;
  onAnimation: (patch: Partial<AnimationSettings>) => void;
  onPage: (patch: Partial<PageBackground>) => void;
}) {
  const canvas = sceneCanvas(doc, scene);
  const sceneName = findScene(doc, scene)?.name ?? scene;
  const page = doc.page;

  // A theme may point at a slot an admin typed by hand, which is not in the
  // curated list — keep it selectable instead of silently resetting the field.
  const slotOptions = [
    { value: NO_SLOT, label: "بدون خلفية" },
    ...ALL_SLOTS.map((slot) => ({ value: slot.key, label: slot.labelAr })),
    ...(page.slot && !ALL_SLOTS.some((slot) => slot.key === page.slot)
      ? [{ value: page.slot, label: page.slot }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <Panel title="خلفية الصفحة">
        <p className="mb-2 text-[11px] text-fg-muted">
          هذي الخلفية تملأ الشاشة خلف كل شاشات الدعوة بدون استثناء، وما تتكرر داخل كل مشهد.
        </p>
        <div className="flex flex-col gap-2">
          <SelectField
            label="الصورة"
            value={page.slot ?? NO_SLOT}
            options={slotOptions}
            onChange={(slot) => onPage({ slot: slot === NO_SLOT ? null : slot })}
          />
          <SelectField
            label="طريقة العرض"
            value={page.fit}
            options={[
              { value: "cover" as const, label: "تملأ الشاشة" },
              { value: "contain" as const, label: "كاملة داخل الشاشة" },
            ]}
            onChange={(fit) => onPage({ fit })}
          />
          <ColorField
            label="لون الطبقة الفوقية"
            value={page.overlayColor}
            onChange={(overlayColor) => onPage({ overlayColor })}
          />
          <NumberField
            label="شفافية الطبقة الفوقية"
            value={page.overlayOpacity}
            min={0}
            max={1}
            step={0.05}
            slider
            onChange={(overlayOpacity) => onPage({ overlayOpacity })}
          />
        </div>
        <p className="mt-1 text-[11px] text-fg-muted">
          الطبقة الفوقية تخفّف الخلفية عشان النصوص تبقى واضحة — خلّها صفر إذا ما تبيها.
        </p>
      </Panel>

      <Panel title={`مقاس المشهد · ${sceneName}`}>
        <p className="mb-2 text-[11px] text-fg-muted">
          نسبة الأبعاد هي مساحة التصميم — كل المواقع محسوبة كنسبة منها، فتتكيّف مع أي شاشة. المقاس يخص هذا المشهد وحده.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="العرض"
            value={canvas.aspectW}
            min={1}
            step={1}
            onChange={(aspectW) => onScene(scene, { aspectW })}
          />
          <NumberField
            label="الارتفاع"
            value={canvas.aspectH}
            min={1}
            step={1}
            onChange={(aspectH) => onScene(scene, { aspectH })}
          />
        </div>
        <div className="mt-2">
          <NumberField
            label="المنطقة الآمنة"
            suffix="%"
            value={canvas.safeInset}
            min={0}
            max={30}
            step={0.5}
            slider
            onChange={(safeInset) => onScene(scene, { safeInset })}
          />
        </div>
        <p className="mt-1 text-[11px] text-fg-muted">
          المساطر والخطوط الإرشادية تظهر في المحرر فقط، وما تظهر أبدًا في الدعوة الحقيقية.
        </p>
      </Panel>

      <Panel title="الحركة">
        <div className="flex flex-col gap-2">
          <SelectField
            label="دخول الظرف"
            value={doc.animation.envelopeEntrance}
            options={ENVELOPE_ENTRANCES.map((v) => ({ value: v, label: ENTRANCE_LABELS[v] ?? v }))}
            onChange={(envelopeEntrance) => onAnimation({ envelopeEntrance })}
          />
          <SelectField
            label="فتح الظرف"
            value={doc.animation.envelopeOpening}
            options={ENVELOPE_OPENINGS.map((v) => ({ value: v, label: ENTRANCE_LABELS[v] ?? v }))}
            onChange={(envelopeOpening) => onAnimation({ envelopeOpening })}
          />
          <SelectField
            label="دخول البطاقة"
            value={doc.animation.cardEntrance}
            options={CARD_ENTRANCES.map((v) => ({ value: v, label: ENTRANCE_LABELS[v] ?? v }))}
            onChange={(cardEntrance) => onAnimation({ cardEntrance })}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="المدة"
              suffix="ms"
              value={doc.animation.duration}
              min={0}
              max={3000}
              step={50}
              onChange={(duration) => onAnimation({ duration })}
            />
            <NumberField
              label="التأخير"
              suffix="ms"
              value={doc.animation.delay}
              min={0}
              max={3000}
              step={50}
              onChange={(delay) => onAnimation({ delay })}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}
