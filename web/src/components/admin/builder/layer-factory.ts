import { slotLabelAr } from "@/lib/themes/builder/slots";
import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  type Layer,
  type LayerType,
  type SceneId,
  type TextStyle,
} from "@/lib/themes/builder/types";

/**
 * One place for the small style tweaks the block defaults keep repeating.
 * Colours are palette roles (`@fg`, `@accent`, …) so a new element takes each
 * colour's own ink from the moment it lands on the canvas.
 */
function style(patch: Partial<TextStyle>): TextStyle {
  return { ...DEFAULT_TEXT_STYLE, ...patch };
}

/**
 * Sensible starting geometry per layer type. A new element should land
 * somewhere usable and visible — dropping everything at 80% width in the dead
 * centre makes the first drag a correction rather than a placement.
 *
 * The block types (countdown, rsvp, schedule, notes) are wider and taller than
 * a text box because they render several rows of their own: a 60%-wide RSVP
 * form is a squeezed form, not a smaller one.
 */
export function createLayer(type: LayerType, scene: SceneId, z: number, slot?: string): Layer {
  const id = `l_${crypto.randomUUID().slice(0, 8)}`;
  const common = { id, scene, z, visible: true, locked: false } as const;

  switch (type) {
    case "asset":
      return {
        ...common,
        type: "asset",
        name: slot ? slotLabelAr(slot) : "صورة",
        slot: slot ?? "decoration",
        fit: slot === "background" ? "cover" : "contain",
        base:
          slot === "background"
            ? { ...DEFAULT_TRANSFORM, width: 100, height: 100 }
            : { ...DEFAULT_TRANSFORM, width: 82 },
      };

    case "text":
      return {
        ...common,
        type: "text",
        name: "نص",
        source: "content",
        text: "",
        fields: ["guestName"],
        style: style({ fontSize: 18, font: "@display" }),
        base: { ...DEFAULT_TRANSFORM, width: 60, height: 12, y: 40 },
      };

    case "seal":
      return {
        ...common,
        type: "seal",
        name: "أحرف الختم",
        mode: "initials",
        script: "latin",
        order: "groom-first",
        text: "",
        separator: "&",
        maxChars: 1,
        style: style({ font: "@latin", fontSize: 14, letterSpacing: 0.05 }),
        base: { ...DEFAULT_TRANSFORM, width: 16, height: 6, y: 62 },
      };

    case "qr":
      return {
        ...common,
        type: "qr",
        name: "الباركود",
        padding: 6,
        borderRadius: 8,
        background: "#FFFFFF",
        borderColor: "#000000",
        borderWidth: 0,
        fgColor: "#000000",
        base: { ...DEFAULT_TRANSFORM, width: 24, height: 16, y: 72 },
      };

    case "countdown":
      return {
        ...common,
        type: "countdown",
        name: "العد التنازلي",
        title: "يفصلنا عن الموعد",
        titleStyle: style({ font: "@display", fontSize: 14 }),
        numberStyle: style({ font: "@latin", fontSize: 26, fontWeight: 500 }),
        labelStyle: style({ fontSize: 10, color: "@fgMuted" }),
        boxColor: "#FFFFFF",
        boxOpacity: 0,
        borderColor: "@accent",
        borderWidth: 1,
        borderRadius: 12,
        showSeconds: true,
        base: { ...DEFAULT_TRANSFORM, width: 78, height: 20, y: 50 },
      };

    case "button":
      return {
        ...common,
        type: "button",
        name: "زر",
        action: "calendar",
        label: "أضف الموعد للتقويم",
        href: "",
        style: style({ fontSize: 13, color: "@accentFg" }),
        background: "@accent",
        backgroundOpacity: 1,
        borderColor: "@accent",
        borderWidth: 0,
        borderRadius: 999,
        base: { ...DEFAULT_TRANSFORM, width: 56, height: 8, y: 88 },
      };

    case "rsvp":
      return {
        ...common,
        type: "rsvp",
        name: "تأكيد الحضور",
        title: "تأكيد الحضور",
        titleStyle: style({ font: "@display", fontSize: 18 }),
        fieldStyle: style({ fontSize: 13, align: "start" }),
        fieldBackground: "@surface",
        borderColor: "@fgMuted",
        borderRadius: 12,
        accent: "@accent",
        accentFg: "@accentFg",
        base: { ...DEFAULT_TRANSFORM, width: 88, height: 72, y: 50 },
      };

    case "schedule":
      return {
        ...common,
        type: "schedule",
        name: "برنامج الحفل",
        title: "برنامج الحفل",
        titleStyle: style({ font: "@display", fontSize: 16 }),
        timeStyle: style({ font: "@latin", fontSize: 13, align: "start" }),
        labelStyle: style({ fontSize: 13, align: "end" }),
        rowGap: 6,
        base: { ...DEFAULT_TRANSFORM, width: 80, height: 44, y: 50 },
      };

    case "notes":
      return {
        ...common,
        type: "notes",
        name: "ملاحظات",
        title: "ملاحظات مهمة",
        titleStyle: style({ font: "@display", fontSize: 16 }),
        itemStyle: style({ fontSize: 13, align: "start", lineHeight: 1.8 }),
        bullet: "•",
        base: { ...DEFAULT_TRANSFORM, width: 80, height: 34, y: 52 },
      };
  }
}
