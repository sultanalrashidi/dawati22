import type { ScheduleItem } from "@/lib/events/types";
import type { SceneCanvas, ScheduleLayer, Transform, TypographyDoc } from "@/lib/themes/builder/types";
import { justifyFor, layerHeightCqw, scaled, textStyleToCss } from "./style";

/**
 * The event-day timeline, positioned as one block.
 *
 * Rows come from the organiser's own schedule, so a design authored here never
 * bakes in "8:00 استقبال" — it lays out however many rows that event carries.
 */

/** Shown while designing, when no event has been attached to the stage yet. */
const SAMPLE_ITEMS: ScheduleItem[] = [
  { time: "8:00 م", labelAr: "استقبال الضيوف" },
  { time: "9:30 م", labelAr: "العشاء" },
  { time: "11:00 م", labelAr: "الزفة" },
];

export function ScheduleContent({
  layer,
  typography,
  transform,
  canvas,
  scheduleItems,
}: {
  layer: ScheduleLayer;
  typography: TypographyDoc;
  transform: Transform;
  canvas: SceneCanvas;
  /**
   * `undefined` means no event is attached — the editor — and the sample rows
   * stand in. `null` or `[]` means this event genuinely has no schedule, and a
   * real guest must not be shown invented times.
   */
  scheduleItems?: ScheduleItem[] | null;
}) {
  const items = scheduleItems === undefined ? SAMPLE_ITEMS : (scheduleItems ?? []);

  const titleCss = textStyleToCss(layer.titleStyle, typography);
  const timeCss = textStyleToCss(layer.timeStyle, typography);
  const labelCss = textStyleToCss(layer.labelStyle, typography);

  // The gap is authored as a share of the layer's own height, so it has to be
  // converted into the stage-relative unit the rest of the block is measured
  // in. A row is roughly one line of its label, which is the height an
  // auto-height block will settle at.
  const naturalHeightPx = Math.max(1, items.length) * layer.labelStyle.fontSize * layer.labelStyle.lineHeight;
  const gap = (layer.rowGap / 100) * layerHeightCqw(transform, canvas, naturalHeightPx);

  return (
    <div
      dir="rtl"
      className="flex h-full w-full flex-col"
      style={{ gap: `${gap}cqw`, justifyContent: justifyFor(layer.titleStyle.align) }}
    >
      {layer.title && <div style={titleCss}>{layer.title}</div>}
      {items.map((item, index) => (
        <div
          key={`${item.time}-${index}`}
          className="flex w-full items-baseline justify-between"
          style={{ gap: scaled(10) }}
        >
          <span style={{ ...labelCss, textAlign: "start" }}>{item.labelAr}</span>
          <span style={{ ...timeCss, textAlign: "end" }}>{item.time}</span>
        </div>
      ))}
    </div>
  );
}
