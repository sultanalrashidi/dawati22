import {
  DEFAULT_CANVAS,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  SCENE_COVER,
  SCENE_OPEN,
  SCENE_PASS,
  type Layer,
  type SceneDef,
  type TextStyle,
} from "@/lib/themes/builder/types";

/**
 * The screens every invitation had before scenes became designable.
 *
 * Until v2 the guest flow was hardcoded: after the opened card came the
 * greeting, the countdown, the details, the schedule, the notes and the RSVP
 * form, and a builder theme got all six for free because it only replaced
 * three screens. Now the flow IS the scene list — so a document that names
 * only cover/open/pass would silently lose those six screens.
 *
 * This module is the single definition of that default flow, used in three
 * places so they can never drift: a brand-new theme starts with it, a
 * converted LEGACY theme receives it, and a stored v1 document has it grafted
 * on as it is upgraded. Every piece is an ordinary scene and an ordinary
 * layer, so the admin can move, restyle or delete any of it.
 */

const INK = "#5C4526";
const INK_MUTED = "#8C7248";

const style = (over: Partial<TextStyle>): TextStyle => ({ ...DEFAULT_TEXT_STYLE, ...over });

export const FLOW_SCENE_TEMPLATES: SceneDef[] = [
  { id: "greeting", name: "الترحيب والأسماء", role: "flow", canvas: DEFAULT_CANVAS, visible: true, requires: null },
  { id: "countdown", name: "العد التنازلي", role: "flow", canvas: DEFAULT_CANVAS, visible: true, requires: null },
  { id: "details", name: "كل ما يهمكم", role: "flow", canvas: DEFAULT_CANVAS, visible: true, requires: null },
  { id: "schedule", name: "برنامج اليوم", role: "flow", canvas: DEFAULT_CANVAS, visible: true, requires: "schedule" },
  { id: "notes", name: "ملاحظات", role: "flow", canvas: DEFAULT_CANVAS, visible: true, requires: "notes" },
  { id: "rsvp", name: "تأكيد الحضور", role: "flow", canvas: DEFAULT_CANVAS, visible: true, requires: null },
];

/** The full ordered list a fresh document starts from. */
export function defaultSceneList(): SceneDef[] {
  return [
    { id: SCENE_COVER, name: "الظرف المغلق", role: "cover", canvas: DEFAULT_CANVAS, visible: true, requires: null },
    { id: SCENE_OPEN, name: "الظرف المفتوح", role: "flow", canvas: DEFAULT_CANVAS, visible: true, requires: null },
    ...FLOW_SCENE_TEMPLATES.map((scene) => ({ ...scene })),
    { id: SCENE_PASS, name: "بطاقة الدخول", role: "pass", canvas: DEFAULT_CANVAS, visible: true, requires: null },
  ];
}

/**
 * Layers reproducing what each default flow scene used to render.
 *
 * Ids are prefixed `f_` and are stable, so grafting them onto a document twice
 * is idempotent — the caller skips any whose id is already present.
 */
export function defaultFlowLayers(): Layer[] {
  return [
    // --- Greeting: families line, invitation text, couple names, date -----
    {
      id: "f_greeting_host", type: "text", name: "ترحيب العائلات", scene: "greeting",
      z: 0, visible: true, locked: false, source: "content", text: "", fields: ["greeting"],
      style: style({ font: "@display", fontSize: 20, color: INK, lineHeight: 1.7 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 28, width: 78, height: 14 },
    },
    {
      id: "f_greeting_text", type: "text", name: "نص الدعوة", scene: "greeting",
      z: 1, visible: true, locked: false, source: "content", text: "", fields: ["invitationText"],
      style: style({ fontSize: 13, color: INK_MUTED, lineHeight: 1.9 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 45, width: 74, height: 12 },
    },
    {
      id: "f_greeting_couples", type: "text", name: "أسماء العروسين", scene: "greeting",
      z: 2, visible: true, locked: false, source: "content", text: "", fields: ["coupleNames"],
      style: style({ font: "@display", fontSize: 22, color: INK, lineHeight: 1.6 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 60, width: 78, height: 14 },
    },
    {
      id: "f_greeting_date", type: "text", name: "التاريخ", scene: "greeting",
      z: 3, visible: true, locked: false, source: "content", text: "", fields: ["eventDate"],
      style: style({ fontSize: 13, color: INK, lineHeight: 1.8 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 74, width: 74, height: 7 },
    },

    // --- Countdown --------------------------------------------------------
    {
      id: "f_countdown", type: "countdown", name: "العد التنازلي", scene: "countdown",
      z: 0, visible: true, locked: false,
      title: "يفصلنا عن المناسبة",
      titleStyle: style({ font: "@display", fontSize: 18, color: INK_MUTED }),
      numberStyle: style({ fontSize: 22, fontWeight: 600, color: INK }),
      labelStyle: style({ fontSize: 10, color: INK_MUTED }),
      boxColor: "#FFFFFF", boxOpacity: 0,
      borderColor: INK_MUTED, borderWidth: 1, borderRadius: 16,
      showSeconds: true,
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 46, width: 82, height: 26 },
    },

    // --- Details ----------------------------------------------------------
    {
      id: "f_details_title", type: "text", name: "عنوان التفاصيل", scene: "details",
      z: 0, visible: true, locked: false, source: "static", text: "كل ما يهمكم", fields: [],
      style: style({ font: "@display", fontSize: 24, color: INK }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 32, width: 70, height: 9 },
    },
    {
      id: "f_details_when", type: "text", name: "التاريخ والوقت", scene: "details",
      z: 1, visible: true, locked: false, source: "content", text: "", fields: ["eventDate", "eventTime"],
      style: style({ fontSize: 14, color: INK, lineHeight: 1.9 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 46, width: 76, height: 11 },
    },
    {
      id: "f_details_where", type: "text", name: "الموقع", scene: "details",
      z: 2, visible: true, locked: false, source: "content", text: "", fields: ["locationFull"],
      style: style({ fontSize: 12, color: INK_MUTED, lineHeight: 1.8 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 56, width: 76, height: 7 },
    },
    {
      id: "f_details_calendar", type: "button", name: "زر التقويم", scene: "details",
      z: 3, visible: true, locked: false, action: "calendar", label: "أضيفوها إلى تقويمكم", href: "",
      style: style({ fontSize: 13, color: INK }),
      background: "#FFFFFF", backgroundOpacity: 0,
      borderColor: INK_MUTED, borderWidth: 1, borderRadius: 100,
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 68, width: 62, height: 9 },
    },
    {
      id: "f_details_map", type: "button", name: "زر الخريطة", scene: "details",
      z: 4, visible: true, locked: false, action: "map", label: "الموقع على الخريطة", href: "",
      style: style({ fontSize: 13, color: INK }),
      background: "#FFFFFF", backgroundOpacity: 0,
      borderColor: INK_MUTED, borderWidth: 1, borderRadius: 100,
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 78, width: 62, height: 9 },
    },

    // --- Schedule / notes -------------------------------------------------
    {
      id: "f_schedule", type: "schedule", name: "برنامج اليوم", scene: "schedule",
      z: 0, visible: true, locked: false, title: "برنامج اليوم",
      titleStyle: style({ font: "@display", fontSize: 22, color: INK }),
      timeStyle: style({ fontSize: 12, fontWeight: 600, color: INK }),
      labelStyle: style({ fontSize: 12, color: INK_MUTED }),
      rowGap: 6,
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 50, width: 80, height: 46 },
    },
    {
      id: "f_notes", type: "notes", name: "ملاحظات", scene: "notes",
      z: 0, visible: true, locked: false, title: "ملاحظات",
      titleStyle: style({ font: "@display", fontSize: 22, color: INK }),
      itemStyle: style({ fontSize: 12, color: INK_MUTED, lineHeight: 1.9 }),
      bullet: "•",
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 50, width: 80, height: 42 },
    },

    // --- RSVP -------------------------------------------------------------
    {
      id: "f_rsvp", type: "rsvp", name: "تأكيد الحضور", scene: "rsvp",
      z: 0, visible: true, locked: false, title: "نرجو تأكيد حضوركم",
      titleStyle: style({ font: "@display", fontSize: 24, color: INK }),
      fieldStyle: style({ fontSize: 14, color: INK, align: "start" }),
      fieldBackground: "#FFFFFF",
      borderColor: INK_MUTED, borderRadius: 14,
      accent: "#9A754D", accentFg: "#FFFFFF",
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 50, width: 88, height: 76 },
    },
  ];
}

/** Graft the default flow onto a document that lacks it, without duplicating. */
export function withDefaultFlow(scenes: SceneDef[], layers: Layer[]): { scenes: SceneDef[]; layers: Layer[] } {
  const haveScene = new Set(scenes.map((s) => s.id));
  const haveLayer = new Set(layers.map((l) => l.id));

  const passIndex = scenes.findIndex((s) => s.role === "pass");
  const additions = FLOW_SCENE_TEMPLATES.filter((s) => !haveScene.has(s.id)).map((s) => ({ ...s }));
  const nextScenes = [...scenes];
  // Flow scenes belong before the entry pass, which is always last.
  nextScenes.splice(passIndex === -1 ? nextScenes.length : passIndex, 0, ...additions);

  const addedIds = new Set(additions.map((s) => s.id));
  const nextLayers = [
    ...layers,
    ...defaultFlowLayers().filter((l) => addedIds.has(l.scene) && !haveLayer.has(l.id)),
  ];

  return { scenes: nextScenes, layers: nextLayers };
}
