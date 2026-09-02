import {
  DEFAULT_CANVAS,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  SCENE_COVER,
  SCENE_OPEN,
  SCENE_PASS,
  type ContentField,
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
  { id: "details", name: "تفاصيل المناسبة", role: "flow", canvas: DEFAULT_CANVAS, visible: true, requires: null },
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
    // --- Greeting: the invitation in reading order -------------------------
    // Opening (basmala / verse / dua), the host line with the fixed verb, the
    // couple line in the host's chosen format, "وذلك بمشيئة الله تعالى", the
    // date. The verse is the tallest opening (three lines), so its box is the
    // deepest; everything below is placed to clear it.
    {
      id: "f_greeting_opening", type: "text", name: "الافتتاحية", scene: "greeting",
      z: 0, visible: true, locked: false, source: "content", text: "", fields: ["opening"],
      style: style({ font: "@display", fontSize: 15, color: INK, lineHeight: 1.8 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 17, width: 82, height: 16 },
    },
    {
      id: "f_greeting_host", type: "text", name: "سطر الداعي", scene: "greeting",
      z: 1, visible: true, locked: false, source: "content", text: "", fields: ["hostLine", "inviteVerb"],
      style: style({ fontSize: 13, color: INK, lineHeight: 1.9 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 36, width: 78, height: 13 },
    },
    {
      id: "f_greeting_couples", type: "text", name: "سطر العروسين", scene: "greeting",
      z: 2, visible: true, locked: false, source: "content", text: "", fields: ["coupleLine"],
      style: style({ font: "@display", fontSize: 24, color: INK, lineHeight: 1.6 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 52, width: 78, height: 13 },
    },
    {
      id: "f_greeting_inshallah", type: "text", name: "بمشيئة الله", scene: "greeting",
      z: 3, visible: true, locked: false, source: "content", text: "", fields: ["inshallah"],
      style: style({ fontSize: 13, color: INK_MUTED, lineHeight: 1.8 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 63, width: 74, height: 6 },
    },
    {
      id: "f_greeting_date", type: "text", name: "التاريخ", scene: "greeting",
      z: 4, visible: true, locked: false, source: "content", text: "", fields: ["eventDate"],
      style: style({ fontSize: 13, color: INK, lineHeight: 1.8 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 74, width: 74, height: 9 },
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
      z: 0, visible: true, locked: false, source: "static", text: "تفاصيل المناسبة", fields: [],
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
    {
      id: "f_details_closing", type: "text", name: "الخاتمة", scene: "details",
      z: 5, visible: true, locked: false, source: "content", text: "", fields: ["closing"],
      style: style({ font: "@display", fontSize: 16, color: INK, lineHeight: 1.7 }),
      base: { ...DEFAULT_TRANSFORM, x: 50, y: 89, width: 76, height: 6 },
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

// ---------------------------------------------------------------------------
// Parse-time upgrade of the stock greeting layers
// ---------------------------------------------------------------------------

/**
 * The greeting layers `defaultFlowLayers()` used to hand out, before the
 * invitation wording was redesigned: the families' greeting, the free
 * invitation text and the couple names. A stored document still carrying one
 * of these — same id, same single field, still content-sourced — is provably
 * untouched stock, so it is safe to swap for the redesigned set.
 *
 * `f_greeting_date` survived the redesign unchanged and is left alone.
 */
const STOCK_V1_GREETING_FIELDS: Readonly<Record<string, readonly ContentField[]>> = {
  f_greeting_host: ["greeting"],
  f_greeting_text: ["invitationText"],
  f_greeting_couples: ["coupleNames"],
};

/** The details title the old stock flow shipped with; retitled by the upgrade. */
const STOCK_V1_DETAILS_TITLE = "كل ما يهمكم";
const DETAILS_TITLE = "تفاصيل المناسبة";

const UPGRADED_GREETING_IDS = ["f_greeting_opening", "f_greeting_host", "f_greeting_couples", "f_greeting_inshallah"];

function isStockV1Greeting(layer: Layer): boolean {
  if (layer.type !== "text" || layer.source !== "content") return false;
  const stock = STOCK_V1_GREETING_FIELDS[layer.id];
  return stock !== undefined && layer.fields.length === stock.length && layer.fields.every((f, i) => f === stock[i]);
}

/**
 * Replace the old stock greeting layers of a stored document with the
 * redesigned ones, so production designs saved before the wording redesign
 * show the new invitation without anyone rewiring them by hand.
 *
 * Only provably untouched stock is touched: the stock v1 greeting layers are
 * removed, and each redesigned greeting layer is added only when nothing else
 * already holds its id (an admin-customized layer keeps its id and is never
 * replaced or duplicated). In the same pass, a `details` scene gains the
 * closing line when absent, and the stock details title is retitled. A
 * document with no stock v1 layer is returned as is — which makes a second
 * pass over this function's own output a no-op.
 */
export function upgradeStockFlowLayers(scenes: SceneDef[], layers: Layer[]): Layer[] {
  const firstStock = layers.findIndex(isStockV1Greeting);
  if (firstStock === -1) return layers;

  const haveScene = new Set(scenes.map((s) => s.id));
  const kept = layers.filter((l) => !isStockV1Greeting(l));
  const haveLayer = new Set(kept.map((l) => l.id));
  const stock = defaultFlowLayers();

  const greetingAdditions = haveScene.has("greeting")
    ? stock.filter((l) => UPGRADED_GREETING_IDS.includes(l.id) && !haveLayer.has(l.id))
    : [];
  const detailsAdditions =
    haveScene.has("details") && !haveLayer.has("f_details_closing")
      ? stock.filter((l) => l.id === "f_details_closing")
      : [];

  const retitled = kept.map((l) =>
    haveScene.has("details") &&
    l.id === "f_details_title" &&
    l.type === "text" &&
    l.source === "static" &&
    l.text === STOCK_V1_DETAILS_TITLE
      ? { ...l, text: DETAILS_TITLE }
      : l,
  );

  // The new greeting layers take the place of the first removed one, so the
  // editor's layer list keeps the scene grouped; the closing line follows the
  // last details layer for the same reason.
  const greetingAt = Math.min(firstStock, retitled.length);
  const out = [...retitled.slice(0, greetingAt), ...greetingAdditions, ...retitled.slice(greetingAt)];
  if (detailsAdditions.length > 0) {
    let lastDetails = -1;
    out.forEach((l, i) => {
      if (l.scene === "details") lastDetails = i;
    });
    out.splice(lastDetails + 1, 0, ...detailsAdditions);
  }
  return withUniqueZ(withUniqueZ(out, "greeting"), "details");
}

/**
 * Give every layer of one scene its own `z` when the upgrade left two
 * sharing one — the stock v1 date sat at z=3, where the redesigned
 * "بمشيئة الله" line now lands. The editor reorders layers by swapping their
 * `z` values, which is a no-op between equals, so a tie would leave the
 * admin unable to move those two past each other. Paint order is kept:
 * layers are renumbered in their current order (by `z`, then list position),
 * and a scene with no tie is returned untouched.
 */
function withUniqueZ(layers: Layer[], scene: string): Layer[] {
  const own = layers.filter((l) => l.scene === scene);
  if (new Set(own.map((l) => l.z)).size === own.length) return layers;
  const ordered = own
    .map((layer, index) => ({ layer, index }))
    .sort((p, q) => p.layer.z - q.layer.z || p.index - q.index);
  const nextZ = new Map(ordered.map(({ layer }, z) => [layer.id, z]));
  return layers.map((l) => {
    const z = nextZ.get(l.id);
    return z === undefined || z === l.z ? l : { ...l, z };
  });
}
