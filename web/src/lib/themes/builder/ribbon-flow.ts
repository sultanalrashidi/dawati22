import type { Layer, LayoutDoc, TextStyle } from "@/lib/themes/builder/types";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";
import { RIBBON_THEME_SLUG } from "./ribbon-greeting";

export const RIBBON_FLOW_SCENES = ["countdown", "details", "schedule", "notes", "rsvp"] as const;
const TARGETS = {
  f_countdown: ["countdown", "countdown"],
  f_details_title: ["details", "text"],
  f_details_when: ["details", "text"],
  f_details_where: ["details", "text"],
  f_details_calendar: ["details", "button"],
  f_details_map: ["details", "button"],
  f_details_closing: ["details", "text"],
  f_schedule: ["schedule", "schedule"],
  f_notes: ["notes", "notes"],
  f_rsvp: ["rsvp", "rsvp"],
} as const;
export const RIBBON_FLOW_IDS = Object.keys(TARGETS);

const BODY = "IBM Plex Sans Arabic";
function text(style: TextStyle, size: number, options: Partial<TextStyle> = {}): TextStyle {
  return { ...style, font: BODY, fontSize: size, fontWeight: 400, lineHeight: 1.7, letterSpacing: 0, ...options };
}
function heading(style: TextStyle, size = 31): TextStyle {
  return text(style, size, { font: "Amiri", align: "center", lineHeight: 1.6 });
}
function position(layer: Layer, y: number, width: number, height: number) {
  return { ...layer.base, x: 50, y, width, height, scale: 1, rotation: 0, opacity: 1 };
}

function polish(layer: Layer): Layer {
  switch (layer.type) {
    case "countdown":
      return { ...layer, base: position(layer, 45, 86, 32),
        titleStyle: heading(layer.titleStyle),
        numberStyle: text(layer.numberStyle, 38, { font: "Cormorant Garamond", fontWeight: 500, lineHeight: 1.2 }),
        labelStyle: text(layer.labelStyle, 16), borderRadius: 12 };
    case "schedule":
      return { ...layer, base: position(layer, 47, 80, 62), overflow: "scroll",
        titleStyle: heading(layer.titleStyle),
        timeStyle: text(layer.timeStyle, 19, { fontWeight: 500 }),
        labelStyle: text(layer.labelStyle, 19, { align: "start" }), rowGap: 7 };
    case "notes":
      return { ...layer, base: position(layer, 47, 80, 62), overflow: "scroll",
        titleStyle: heading(layer.titleStyle), itemStyle: text(layer.itemStyle, 19, { lineHeight: 2, align: "start" }) };
    case "rsvp":
      return { ...layer, base: position(layer, 50, 84, 86), overflow: "scroll",
        titleStyle: heading(layer.titleStyle, 29),
        fieldStyle: text(layer.fieldStyle, 18, { align: "start" }), borderRadius: 10 };
    case "button":
      return { ...layer, base: position(layer, layer.id === "f_details_calendar" ? 60 : 71.5, 78, 10.5),
        style: text(layer.style, 17, { fontWeight: 500 }), borderRadius: 12 };
    case "text": {
      if (layer.id === "f_details_title") return { ...layer, base: position(layer, 19, 82, 10), style: heading(layer.style, 32) };
      if (layer.id === "f_details_when") return { ...layer, base: position(layer, 33, 80, 16),
        style: text(layer.style, 19, { fontWeight: 500, lineHeight: 1.8 }) };
      if (layer.id === "f_details_where") return { ...layer, base: position(layer, 47.5, 80, 11),
        style: text(layer.style, 18, { lineHeight: 1.8 }) };
      return { ...layer, base: position(layer, 82, 80, 6), style: heading(layer.style, 21) };
    }
    default: return layer;
  }
}

type Proposal = { ok: true; layout: LayoutDoc } | { ok: false; reason: string };

/** Explicit, undoable editor proposal. Never run automatically by a loader. */
export function proposeRibbonFlow(themeSlug: string, doc: LayoutDoc, overrides: readonly LayoutOverrides[] = []): Proposal {
  if (themeSlug !== RIBBON_THEME_SLUG) return { ok: false, reason: "هذا التنسيق مخصص لفيونكة الورد." };
  for (const id of RIBBON_FLOW_SCENES) {
    const scenes = doc.scenes.filter((scene) => scene.id === id);
    const scene = scenes[0];
    if (scenes.length !== 1 || !scene.visible || scene.role !== "flow" || scene.canvas.aspectW !== 390 || scene.canvas.aspectH !== 620) {
      return { ok: false, reason: "إحدى الشاشات الخمس مخفية أو ذات مقاس مخصص؛ يلزم مراجعتها يدويًا." };
    }
    if (doc.layers.some((layer) => layer.scene === id && !RIBBON_FLOW_IDS.includes(layer.id))) {
      return { ok: false, reason: "توجد عناصر إضافية في هذه الشاشات؛ لم نغيّر ترتيبها تلقائيًا." };
    }
  }
  for (const [id, [sceneId, type]] of Object.entries(TARGETS)) {
    const matches = doc.layers.filter((layer) => layer.id === id);
    const layer = matches[0];
    if (matches.length !== 1 || layer.type !== type || layer.scene !== sceneId || !layer.visible || layer.locked) {
      return { ok: false, reason: "إحدى الطبقات محذوفة أو مقفلة أو مخصصة؛ يلزم مراجعتها يدويًا." };
    }
    const responsive = [layer.tablet, layer.desktop,
      ...("tabletStyle" in layer ? [layer.tabletStyle] : []), ...("desktopStyle" in layer ? [layer.desktopStyle] : [])];
    if (responsive.some((value) => value && Object.keys(value).length)) {
      return { ok: false, reason: "توجد إعدادات مخصصة لمقاسات أخرى؛ لم نستبدلها." };
    }
    if (overrides.some((variant) => variant[id] && Object.keys(variant[id]).some((key) => key !== "paint"))) {
      return { ok: false, reason: "أحد الألوان له ترتيب خاص في هذه الشاشات؛ لم نستبدله." };
    }
    if (layer.type === "text") {
      const fields = { f_details_title: [], f_details_when: ["eventDate", "eventTime"],
        f_details_where: ["locationFull"], f_details_closing: ["closing"] }[id];
      if (JSON.stringify(layer.fields) !== JSON.stringify(fields) || layer.source !== (id === "f_details_title" ? "static" : "content")) {
        return { ok: false, reason: "توجد روابط نصوص مخصصة؛ لم نغيّرها." };
      }
    }
    if (layer.type === "button" && layer.action !== (id === "f_details_calendar" ? "calendar" : "map")) {
      return { ok: false, reason: "وظيفة أحد الأزرار مخصصة؛ لم نغيّرها." };
    }
    const next = polish(layer).base;
    const inset = doc.scenes.find((scene) => scene.id === sceneId)!.canvas.safeInset;
    if (next.x - next.width / 2 < inset || next.x + next.width / 2 > 100 - inset ||
        next.y - next.height! / 2 < inset || next.y + next.height! / 2 > 100 - inset) {
      return { ok: false, reason: "المنطقة الآمنة مخصصة؛ لم نضع العناصر خارج حدودها." };
    }
  }
  return { ok: true, layout: { ...doc, layers: doc.layers.map((layer) => RIBBON_FLOW_IDS.includes(layer.id) ? polish(layer) : layer) } };
}
