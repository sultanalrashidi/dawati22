"use client";

import {
  ColorField,
  Field,
  GhostButton,
  NumberField,
  Panel,
  SelectField,
  TextField,
  ToggleField,
} from "@/components/admin/builder/builder-ui";
import { ALL_SLOTS } from "@/lib/themes/builder/slots";
import { BUTTON_ACTIONS, CONTENT_FIELD_LABELS_AR, CONTENT_FIELDS, resolveTextStyle, resolveTransform, type Breakpoint, type ButtonAction, type ContentField, type Layer, type TextStyle, type TextStyleOverride, type TransformOverride, type TypographyDoc } from "@/lib/themes/builder/types";
import type { FontOption } from "@/lib/themes/font-registry";

const ALIGN_OPTIONS = [
  { value: "start" as const, label: "يمين" },
  { value: "center" as const, label: "وسط" },
  { value: "end" as const, label: "يسار" },
];

const WEIGHT_OPTIONS = [300, 400, 500, 600, 700, 800].map((weight) => ({
  value: String(weight),
  label: String(weight),
}));

const BREAKPOINT_LABEL: Record<Breakpoint, string> = {
  base: "الجوال",
  tablet: "التابلت",
  desktop: "الكمبيوتر",
};

const BUTTON_ACTION_LABELS: Record<ButtonAction, string> = {
  calendar: "إضافة الموعد للتقويم",
  map: "الموقع على الخريطة",
  music: "تشغيل الموسيقى",
  link: "رابط مخصص",
};

const BUTTON_ACTION_HINTS: Record<ButtonAction, string> = {
  calendar: "يضيف موعد المناسبة لتقويم المدعو — ما يحتاج أي رابط.",
  map: "يفتح موقع المناسبة في الخرائط. لازم يكون في المناسبة موقع محدد.",
  music: "يشغّل ويوقف موسيقى المناسبة. لازم تكون فيه موسيقى مرفوعة.",
  link: "يفتح الرابط اللي تكتبه في نافذة جديدة.",
};

/** Font role references plus every installed family. */
function fontOptionsFor(typography: TypographyDoc, fonts: FontOption[]) {
  return [
    ...Object.keys(typography.roles).map((role) => ({ value: `@${role}`, label: `دور: ${role}` })),
    ...fonts.map((font) => ({ value: font.family, label: font.labelAr || font.label })),
  ];
}

type FontOptions = ReturnType<typeof fontOptionsFor>;

export function InspectorPanel({
  layer,
  breakpoint,
  typography,
  fonts,
  onTransform,
  onPatch,
  onTextStyle,
  onClearOverrides,
}: {
  layer: Layer | null;
  breakpoint: Breakpoint;
  typography: TypographyDoc;
  fonts: FontOption[];
  onTransform: (patch: TransformOverride) => void;
  onPatch: (patch: Partial<Layer>) => void;
  onTextStyle: (patch: TextStyleOverride) => void;
  onClearOverrides: () => void;
}) {
  if (!layer) {
    return (
      <Panel title="الخصائص">
        <p className="text-xs text-fg-muted">اختر عنصرًا من الشاشة أو من قائمة الطبقات.</p>
      </Panel>
    );
  }

  const transform = resolveTransform(layer, breakpoint);
  const fontOptions = fontOptionsFor(typography, fonts);
  const hasOverride =
    breakpoint === "tablet"
      ? Boolean(layer.tablet)
      : breakpoint === "desktop"
        ? Boolean(layer.desktop)
        : false;

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="الموقع والحجم"
        action={
          breakpoint !== "base" ? (
            <GhostButton
              title="حذف تخصيص هذا المقاس"
              disabled={!hasOverride}
              onClick={onClearOverrides}
            >
              إرجاع للأساسي
            </GhostButton>
          ) : undefined
        }
      >
        {breakpoint !== "base" && (
          <p className="mb-2 rounded-lg bg-warning/10 px-2 py-1 text-[11px] text-fg-muted">
            التعديل الآن يخص مقاس <b>{BREAKPOINT_LABEL[breakpoint]}</b> فقط، وما يأثر على الجوال.
          </p>
        )}

        <TextField label="اسم الطبقة" value={layer.name} onChange={(name) => onPatch({ name })} />

        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumberField label="X" suffix="%" value={transform.x} step={0.5} onChange={(x) => onTransform({ x })} />
          <NumberField label="Y" suffix="%" value={transform.y} step={0.5} onChange={(y) => onTransform({ y })} />
          <NumberField
            label="العرض"
            suffix="%"
            value={transform.width}
            min={0.5}
            step={0.5}
            onChange={(width) => onTransform({ width })}
          />
          <Field label="الارتفاع (%)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                dir="ltr"
                disabled={transform.height === null}
                value={transform.height ?? 0}
                step={0.5}
                onChange={(event) => {
                  const next = Number.parseFloat(event.target.value);
                  if (Number.isFinite(next)) onTransform({ height: next });
                }}
                className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm text-fg outline-none focus:border-accent disabled:opacity-40"
              />
              <label className="flex shrink-0 items-center gap-1 text-[11px] text-fg-muted">
                <input
                  type="checkbox"
                  checked={transform.height === null}
                  onChange={(event) => onTransform({ height: event.target.checked ? null : 30 })}
                  className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                />
                تلقائي
              </label>
            </div>
          </Field>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <NumberField
            label="التكبير"
            value={transform.scale}
            min={0.05}
            max={4}
            step={0.01}
            slider
            onChange={(scale) => onTransform({ scale })}
          />
          <NumberField
            label="الدوران"
            suffix="°"
            value={transform.rotation}
            min={-180}
            max={180}
            step={1}
            slider
            onChange={(rotation) => onTransform({ rotation })}
          />
          <NumberField
            label="الشفافية"
            value={transform.opacity}
            min={0}
            max={1}
            step={0.01}
            slider
            onChange={(opacity) => onTransform({ opacity })}
          />
        </div>
      </Panel>

      {layer.type === "asset" && (
        <Panel title="الصورة">
          <SelectField
            label="نوع الصورة"
            value={layer.slot}
            options={ALL_SLOTS.map((slot) => ({ value: slot.key, label: slot.labelAr }))}
            onChange={(slot) => onPatch({ slot } as Partial<Layer>)}
          />
          <div className="mt-2">
            <SelectField
              label="الملاءمة"
              value={layer.fit}
              options={[
                { value: "contain" as const, label: "كاملة داخل الإطار" },
                { value: "cover" as const, label: "تملأ الإطار (قص)" },
              ]}
              onChange={(fit) => onPatch({ fit } as Partial<Layer>)}
            />
          </div>
        </Panel>
      )}

      {(layer.type === "text" || layer.type === "seal") && (
        <TypographySection
          layer={layer}
          breakpoint={breakpoint}
          typography={typography}
          fonts={fonts}
          onPatch={onPatch}
          onTextStyle={onTextStyle}
        />
      )}

      {layer.type === "qr" && (
        <Panel title="الباركود">
          <div className="flex flex-col gap-2">
            <NumberField
              label="الهامش الداخلي"
              suffix="%"
              value={layer.padding}
              min={0}
              max={40}
              step={0.5}
              slider
              onChange={(padding) => onPatch({ padding } as Partial<Layer>)}
            />
            <NumberField
              label="استدارة الحواف"
              suffix="px"
              value={layer.borderRadius}
              min={0}
              max={80}
              step={1}
              slider
              onChange={(borderRadius) => onPatch({ borderRadius } as Partial<Layer>)}
            />
            <NumberField
              label="سماكة الإطار"
              suffix="px"
              value={layer.borderWidth}
              min={0}
              max={20}
              step={0.5}
              onChange={(borderWidth) => onPatch({ borderWidth } as Partial<Layer>)}
            />
            <ColorField label="لون الخلفية" value={layer.background} onChange={(background) => onPatch({ background } as Partial<Layer>)} />
            <ColorField label="لون الإطار" value={layer.borderColor} onChange={(borderColor) => onPatch({ borderColor } as Partial<Layer>)} />
            <ColorField label="لون الباركود" value={layer.fgColor} onChange={(fgColor) => onPatch({ fgColor } as Partial<Layer>)} />
          </div>
          <p className="mt-2 text-[11px] text-fg-muted">
            الباركود المعروض هنا تجريبي — كل مدعو يحصل على باركوده الخاص تلقائيًا.
          </p>
        </Panel>
      )}

      {layer.type === "countdown" && (
        <CountdownSection layer={layer} fontOptions={fontOptions} onPatch={onPatch} />
      )}
      {layer.type === "button" && (
        <ButtonSection layer={layer} fontOptions={fontOptions} onPatch={onPatch} />
      )}
      {layer.type === "rsvp" && <RsvpSection layer={layer} fontOptions={fontOptions} onPatch={onPatch} />}
      {layer.type === "schedule" && (
        <ScheduleSection layer={layer} fontOptions={fontOptions} onPatch={onPatch} />
      )}
      {layer.type === "notes" && <NotesSection layer={layer} fontOptions={fontOptions} onPatch={onPatch} />}
    </div>
  );
}

/**
 * One named text style, collapsed behind its own heading.
 *
 * A countdown carries three of these and the RSVP form two. Laid out flat they
 * become twenty-odd identical-looking fields where nothing says which size
 * belongs to the digits and which to their labels, so each style gets a titled
 * group instead.
 */
function StyleGroup({
  title,
  style,
  fontOptions,
  onChange,
  defaultOpen,
}: {
  title: string;
  style: TextStyle;
  fontOptions: FontOptions;
  onChange: (patch: Partial<TextStyle>) => void;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="rounded-lg border border-border bg-bg/40 px-2 py-1.5">
      <summary className="cursor-pointer text-xs font-medium text-fg">{title}</summary>
      <div className="mt-2 flex flex-col gap-2">
        <SelectField
          label="الخط"
          value={style.font}
          options={fontOptions}
          onChange={(font) => onChange({ font })}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="حجم الخط"
            suffix="px"
            value={style.fontSize}
            min={4}
            max={120}
            step={0.5}
            onChange={(fontSize) => onChange({ fontSize })}
          />
          <SelectField
            label="السماكة"
            value={String(style.fontWeight)}
            options={WEIGHT_OPTIONS}
            onChange={(value) => onChange({ fontWeight: Number.parseInt(value, 10) })}
          />
        </div>
        <ColorField label="اللون" value={style.color} onChange={(color) => onChange({ color })} />
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="المحاذاة"
            value={style.align}
            options={ALIGN_OPTIONS}
            onChange={(align) => onChange({ align })}
          />
          <NumberField
            label="ارتفاع السطر"
            value={style.lineHeight}
            min={0.6}
            max={3}
            step={0.05}
            onChange={(lineHeight) => onChange({ lineHeight })}
          />
        </div>
        <NumberField
          label="تباعد الأحرف"
          suffix="em"
          value={style.letterSpacing}
          min={-0.2}
          max={1}
          step={0.01}
          onChange={(letterSpacing) => onChange({ letterSpacing })}
        />
      </div>
    </details>
  );
}

/**
 * The block types carry no per-breakpoint style overrides, unlike text and
 * seal layers — so an admin who just read "التعديل الآن يخص مقاس التابلت" at
 * the top of the inspector needs telling that these fields are not that.
 */
function AllSizesNote() {
  return (
    <p className="mt-2 text-[11px] text-fg-muted">
      تنسيق الخط هنا يطبّق على كل المقاسات. الموقع والحجم فوق هما اللي يتخصّصان لكل مقاس.
    </p>
  );
}

function CountdownSection({
  layer,
  fontOptions,
  onPatch,
}: {
  layer: Extract<Layer, { type: "countdown" }>;
  fontOptions: FontOptions;
  onPatch: (patch: Partial<Layer>) => void;
}) {
  const patchStyle =
    (key: "titleStyle" | "numberStyle" | "labelStyle") => (patch: Partial<TextStyle>) =>
      onPatch({ [key]: { ...layer[key], ...patch } } as Partial<Layer>);

  return (
    <>
      <Panel title="العد التنازلي">
        <div className="flex flex-col gap-2">
          <TextField
            label="العنوان"
            dir="rtl"
            value={layer.title}
            placeholder="يفصلنا عن الموعد"
            onChange={(title) => onPatch({ title } as Partial<Layer>)}
          />
          <ToggleField
            label="إظهار الثواني"
            checked={layer.showSeconds}
            onChange={(showSeconds) => onPatch({ showSeconds } as Partial<Layer>)}
          />
          <ColorField
            label="لون خلفية الأرقام"
            value={layer.boxColor}
            onChange={(boxColor) => onPatch({ boxColor } as Partial<Layer>)}
          />
          <NumberField
            label="شفافية الخلفية"
            value={layer.boxOpacity}
            min={0}
            max={1}
            step={0.05}
            slider
            onChange={(boxOpacity) => onPatch({ boxOpacity } as Partial<Layer>)}
          />
          <ColorField
            label="لون الإطار"
            value={layer.borderColor}
            onChange={(borderColor) => onPatch({ borderColor } as Partial<Layer>)}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="سماكة الإطار"
              suffix="px"
              value={layer.borderWidth}
              min={0}
              max={20}
              step={0.5}
              onChange={(borderWidth) => onPatch({ borderWidth } as Partial<Layer>)}
            />
            <NumberField
              label="استدارة الحواف"
              suffix="px"
              value={layer.borderRadius}
              min={0}
              max={80}
              step={1}
              onChange={(borderRadius) => onPatch({ borderRadius } as Partial<Layer>)}
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-fg-muted">
          الأرقام تنزل لحظيًا حتى موعد المناسبة — اللي يظهر في المحرر مثال فقط.
        </p>
      </Panel>

      <Panel title="خطوط العد التنازلي">
        <div className="flex flex-col gap-2">
          <StyleGroup
            title="العنوان"
            defaultOpen
            style={layer.titleStyle}
            fontOptions={fontOptions}
            onChange={patchStyle("titleStyle")}
          />
          <StyleGroup
            title="الأرقام"
            style={layer.numberStyle}
            fontOptions={fontOptions}
            onChange={patchStyle("numberStyle")}
          />
          <StyleGroup
            title="التسميات (يوم · ساعة · دقيقة)"
            style={layer.labelStyle}
            fontOptions={fontOptions}
            onChange={patchStyle("labelStyle")}
          />
        </div>
        <AllSizesNote />
      </Panel>
    </>
  );
}

function ButtonSection({
  layer,
  fontOptions,
  onPatch,
}: {
  layer: Extract<Layer, { type: "button" }>;
  fontOptions: FontOptions;
  onPatch: (patch: Partial<Layer>) => void;
}) {
  return (
    <>
      <Panel title="الزر">
        <div className="flex flex-col gap-2">
          <SelectField
            label="وظيفة الزر"
            value={layer.action}
            options={BUTTON_ACTIONS.map((action) => ({
              value: action,
              label: BUTTON_ACTION_LABELS[action],
            }))}
            onChange={(action) => onPatch({ action } as Partial<Layer>)}
          />
          <p className="-mt-1 text-[11px] text-fg-muted">{BUTTON_ACTION_HINTS[layer.action]}</p>
          <TextField
            label="نص الزر"
            dir="rtl"
            value={layer.label}
            placeholder="أضف الموعد للتقويم"
            onChange={(label) => onPatch({ label } as Partial<Layer>)}
          />
          {layer.action === "link" && (
            <TextField
              label="الرابط"
              dir="ltr"
              value={layer.href}
              placeholder="https://"
              onChange={(href) => onPatch({ href } as Partial<Layer>)}
            />
          )}
          <ColorField
            label="لون الخلفية"
            value={layer.background}
            onChange={(background) => onPatch({ background } as Partial<Layer>)}
          />
          <NumberField
            label="شفافية الخلفية"
            value={layer.backgroundOpacity}
            min={0}
            max={1}
            step={0.05}
            slider
            onChange={(backgroundOpacity) => onPatch({ backgroundOpacity } as Partial<Layer>)}
          />
          <ColorField
            label="لون الإطار"
            value={layer.borderColor}
            onChange={(borderColor) => onPatch({ borderColor } as Partial<Layer>)}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="سماكة الإطار"
              suffix="px"
              value={layer.borderWidth}
              min={0}
              max={20}
              step={0.5}
              onChange={(borderWidth) => onPatch({ borderWidth } as Partial<Layer>)}
            />
            <NumberField
              label="استدارة الحواف"
              suffix="px"
              value={layer.borderRadius}
              min={0}
              max={200}
              step={1}
              onChange={(borderRadius) => onPatch({ borderRadius } as Partial<Layer>)}
            />
          </div>
        </div>
      </Panel>

      <Panel title="خط الزر">
        <StyleGroup
          title="نص الزر"
          defaultOpen
          style={layer.style}
          fontOptions={fontOptions}
          onChange={(patch) => onPatch({ style: { ...layer.style, ...patch } } as Partial<Layer>)}
        />
        <AllSizesNote />
      </Panel>
    </>
  );
}

function RsvpSection({
  layer,
  fontOptions,
  onPatch,
}: {
  layer: Extract<Layer, { type: "rsvp" }>;
  fontOptions: FontOptions;
  onPatch: (patch: Partial<Layer>) => void;
}) {
  const patchStyle = (key: "titleStyle" | "fieldStyle") => (patch: Partial<TextStyle>) =>
    onPatch({ [key]: { ...layer[key], ...patch } } as Partial<Layer>);

  return (
    <>
      <Panel title="نموذج تأكيد الحضور">
        <p className="mb-2 text-[11px] text-fg-muted">
          النموذج كتلة وحدة — تحركها وتكبّرها وتلوّنها، لكن حقوله وأزراره ما تنفصل عن بعض عشان يظل قادرًا
          يسجّل الحضور فعلًا.
        </p>
        <div className="flex flex-col gap-2">
          <TextField
            label="العنوان"
            dir="rtl"
            value={layer.title}
            placeholder="تأكيد الحضور"
            onChange={(title) => onPatch({ title } as Partial<Layer>)}
          />
          <ColorField
            label="لون خلفية الحقول"
            value={layer.fieldBackground}
            onChange={(fieldBackground) => onPatch({ fieldBackground } as Partial<Layer>)}
          />
          <ColorField
            label="لون حدود الحقول"
            value={layer.borderColor}
            onChange={(borderColor) => onPatch({ borderColor } as Partial<Layer>)}
          />
          <NumberField
            label="استدارة الحواف"
            suffix="px"
            value={layer.borderRadius}
            min={0}
            max={80}
            step={1}
            slider
            onChange={(borderRadius) => onPatch({ borderRadius } as Partial<Layer>)}
          />
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label="لون زر التأكيد"
              value={layer.accent}
              onChange={(accent) => onPatch({ accent } as Partial<Layer>)}
            />
            <ColorField
              label="لون نص الزر"
              value={layer.accentFg}
              onChange={(accentFg) => onPatch({ accentFg } as Partial<Layer>)}
            />
          </div>
        </div>
      </Panel>

      <Panel title="خطوط النموذج">
        <div className="flex flex-col gap-2">
          <StyleGroup
            title="العنوان"
            defaultOpen
            style={layer.titleStyle}
            fontOptions={fontOptions}
            onChange={patchStyle("titleStyle")}
          />
          <StyleGroup
            title="الحقول والأزرار"
            style={layer.fieldStyle}
            fontOptions={fontOptions}
            onChange={patchStyle("fieldStyle")}
          />
        </div>
        <AllSizesNote />
      </Panel>
    </>
  );
}

function ScheduleSection({
  layer,
  fontOptions,
  onPatch,
}: {
  layer: Extract<Layer, { type: "schedule" }>;
  fontOptions: FontOptions;
  onPatch: (patch: Partial<Layer>) => void;
}) {
  const patchStyle =
    (key: "titleStyle" | "timeStyle" | "labelStyle") => (patch: Partial<TextStyle>) =>
      onPatch({ [key]: { ...layer[key], ...patch } } as Partial<Layer>);

  return (
    <>
      <Panel title="برنامج الحفل">
        <p className="mb-2 text-[11px] text-fg-muted">
          الأسطر تجي من برنامج المناسبة نفسها، فتختلف من دعوة لدعوة — أنت تحدد شكلها ومكانها فقط.
        </p>
        <div className="flex flex-col gap-2">
          <TextField
            label="العنوان"
            dir="rtl"
            value={layer.title}
            placeholder="برنامج الحفل"
            onChange={(title) => onPatch({ title } as Partial<Layer>)}
          />
          <NumberField
            label="المسافة بين الأسطر"
            suffix="%"
            value={layer.rowGap}
            min={0}
            max={30}
            step={0.5}
            slider
            onChange={(rowGap) => onPatch({ rowGap } as Partial<Layer>)}
          />
        </div>
      </Panel>

      <Panel title="خطوط البرنامج">
        <div className="flex flex-col gap-2">
          <StyleGroup
            title="العنوان"
            defaultOpen
            style={layer.titleStyle}
            fontOptions={fontOptions}
            onChange={patchStyle("titleStyle")}
          />
          <StyleGroup
            title="الوقت"
            style={layer.timeStyle}
            fontOptions={fontOptions}
            onChange={patchStyle("timeStyle")}
          />
          <StyleGroup
            title="اسم الفقرة"
            style={layer.labelStyle}
            fontOptions={fontOptions}
            onChange={patchStyle("labelStyle")}
          />
        </div>
        <AllSizesNote />
      </Panel>
    </>
  );
}

function NotesSection({
  layer,
  fontOptions,
  onPatch,
}: {
  layer: Extract<Layer, { type: "notes" }>;
  fontOptions: FontOptions;
  onPatch: (patch: Partial<Layer>) => void;
}) {
  const patchStyle = (key: "titleStyle" | "itemStyle") => (patch: Partial<TextStyle>) =>
    onPatch({ [key]: { ...layer[key], ...patch } } as Partial<Layer>);

  return (
    <>
      <Panel title="الملاحظات">
        <p className="mb-2 text-[11px] text-fg-muted">
          الملاحظات تجي من بيانات المناسبة، كل ملاحظة في سطر.
        </p>
        <div className="flex flex-col gap-2">
          <TextField
            label="العنوان"
            dir="rtl"
            value={layer.title}
            placeholder="ملاحظات مهمة"
            onChange={(title) => onPatch({ title } as Partial<Layer>)}
          />
          <TextField
            label="رمز بداية السطر"
            dir="ltr"
            value={layer.bullet}
            placeholder="•"
            onChange={(bullet) => onPatch({ bullet } as Partial<Layer>)}
          />
        </div>
        <p className="mt-1 text-[11px] text-fg-muted">خلّ الخانة فاضية إذا ما تبي رمز قبل كل ملاحظة.</p>
      </Panel>

      <Panel title="خطوط الملاحظات">
        <div className="flex flex-col gap-2">
          <StyleGroup
            title="العنوان"
            defaultOpen
            style={layer.titleStyle}
            fontOptions={fontOptions}
            onChange={patchStyle("titleStyle")}
          />
          <StyleGroup
            title="الملاحظة"
            style={layer.itemStyle}
            fontOptions={fontOptions}
            onChange={patchStyle("itemStyle")}
          />
        </div>
        <AllSizesNote />
      </Panel>
    </>
  );
}

function TypographySection({
  layer,
  breakpoint,
  typography,
  fonts,
  onPatch,
  onTextStyle,
}: {
  layer: Extract<Layer, { type: "text" | "seal" }>;
  breakpoint: Breakpoint;
  typography: TypographyDoc;
  fonts: FontOption[];
  onPatch: (patch: Partial<Layer>) => void;
  onTextStyle: (patch: TextStyleOverride) => void;
}) {
  const style = resolveTextStyle(layer, breakpoint);
  const fontOptions = fontOptionsFor(typography, fonts);

  return (
    <>
      <Panel title={layer.type === "seal" ? "الختم" : "النص"}>
        {layer.type === "text" ? (
          <div className="flex flex-col gap-2">
            <SelectField
              label="مصدر النص"
              value={layer.source}
              options={[
                { value: "static" as const, label: "نص ثابت" },
                { value: "content" as const, label: "بيانات الدعوة" },
              ]}
              onChange={(source) => onPatch({ source } as Partial<Layer>)}
            />
            {layer.source === "static" ? (
              <TextField
                label="النص"
                dir="rtl"
                multiline
                value={layer.text}
                placeholder="بارك الله لهما وبارك عليهما وجمع بينهما في خير"
                onChange={(text) => onPatch({ text } as Partial<Layer>)}
              />
            ) : (
              <Field label="الحقول المعروضة (كل حقل في سطر)">
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-2">
                  {CONTENT_FIELDS.map((field) => (
                    <ToggleField
                      key={field}
                      label={CONTENT_FIELD_LABELS_AR[field]}
                      checked={layer.fields.includes(field)}
                      onChange={(checked) =>
                        onPatch({
                          fields: checked
                            ? [...layer.fields, field]
                            : layer.fields.filter((f: ContentField) => f !== field),
                        } as Partial<Layer>)
                      }
                    />
                  ))}
                </div>
              </Field>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <SelectField
              label="محتوى الختم"
              value={layer.mode}
              options={[
                { value: "initials" as const, label: "أحرف العروسين (تلقائي)" },
                { value: "static" as const, label: "نص ثابت" },
              ]}
              onChange={(mode) => onPatch({ mode } as Partial<Layer>)}
            />
            {layer.mode === "static" ? (
              <TextField label="النص" dir="ltr" value={layer.text} onChange={(text) => onPatch({ text } as Partial<Layer>)} />
            ) : (
              <>
                <SelectField
                  label="لغة الأحرف"
                  value={layer.script}
                  options={[
                    { value: "latin" as const, label: "إنجليزي (F & N)" },
                    { value: "arabic" as const, label: "عربي (ف و ن)" },
                  ]}
                  onChange={(script) => onPatch({ script } as Partial<Layer>)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="الفاصل"
                    dir="ltr"
                    value={layer.separator}
                    onChange={(separator) => onPatch({ separator } as Partial<Layer>)}
                  />
                  <NumberField
                    label="أحرف من كل اسم"
                    value={layer.maxChars}
                    min={1}
                    max={10}
                    onChange={(maxChars) => onPatch({ maxChars } as Partial<Layer>)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </Panel>

      <Panel title="تنسيق الخط">
        <div className="flex flex-col gap-2">
          <SelectField
            label="الخط"
            value={style.font}
            options={fontOptions}
            onChange={(font) => onTextStyle({ font })}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="حجم الخط"
              suffix="px"
              value={style.fontSize}
              min={4}
              max={120}
              step={0.5}
              onChange={(fontSize) => onTextStyle({ fontSize })}
            />
            <SelectField
              label="السماكة"
              value={String(style.fontWeight)}
              options={WEIGHT_OPTIONS}
              onChange={(value) => onTextStyle({ fontWeight: Number.parseInt(value, 10) })}
            />
          </div>
          <ColorField label="اللون" value={style.color} onChange={(color) => onTextStyle({ color })} />
          <SelectField label="المحاذاة" value={style.align} options={ALIGN_OPTIONS} onChange={(align) => onTextStyle({ align })} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="ارتفاع السطر"
              value={style.lineHeight}
              min={0.6}
              max={3}
              step={0.05}
              onChange={(lineHeight) => onTextStyle({ lineHeight })}
            />
            <NumberField
              label="تباعد الأحرف"
              suffix="em"
              value={style.letterSpacing}
              min={-0.2}
              max={1}
              step={0.01}
              onChange={(letterSpacing) => onTextStyle({ letterSpacing })}
            />
          </div>
          <p className="text-[11px] text-fg-muted">
            حجم الخط مقاس على شاشة عرضها 390px ويتكبّر تلقائيًا مع حجم الشاشة.
          </p>
        </div>
      </Panel>
    </>
  );
}
