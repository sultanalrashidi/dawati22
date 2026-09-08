import type { ContentField, LayoutDoc, TextLayer } from "./types";
import type { LayoutOverrides } from "./resolve";
import { RIBBON_THEME_SLUG } from "./ribbon-greeting";

export const RIBBON_PASS_TEXT_IDS = ["li_pass_invitation", "li_pass_couple", "li_pass_godwilling", "li_pass_place", "li_pass_date", "li_pass_time"];
export const RIBBON_PASS_ADDED_IDS = ["rb_pass_title", "rb_pass_guest", "rb_pass_count"];
const KNOWN_IDS = [...RIBBON_PASS_TEXT_IDS, ...RIBBON_PASS_ADDED_IDS, "li_pass_card", "li_pass_qr"];
const ORIGINAL_TABLET: Record<string, number> = { li_pass_invitation: 11.4, li_pass_couple: 20.53, li_pass_godwilling: 11.4 };

function format(layer: TextLayer, x: number, y: number, width: number, height: number, size: number): TextLayer {
  const next = { ...layer };
  delete next.tabletStyle;
  return { ...next,
    base: { ...layer.base, x, y, width, height, rotation: 0, scale: 1, opacity: 1 },
    style: { ...layer.style, font: "Amiri", fontSize: size, fontWeight: 400, lineHeight: 1.3, letterSpacing: 0, align: "center" } };
}
function bound(layer: TextLayer, field: ContentField): TextLayer {
  return { ...layer, source: "content", fields: [field], text: "" };
}
function polish(layer: TextLayer): TextLayer {
  switch (layer.id) {
    // Keep the optional customer-written line, even when it is empty.
    case "li_pass_invitation": return format(layer, 50, 21.5, 68, 7, 18);
    case "li_pass_couple": return format(bound(layer, "coupleLine"), 50, 33.5, 68, 16.5, 42);
    case "li_pass_godwilling": return format(layer, 50, 44.25, 68, 4.5, 21);
    case "li_pass_date": return format(bound(layer, "eventDateShort"), 64, 49, 38, 4.5, 23);
    case "li_pass_time": return format(bound(layer, "eventTime"), 30, 49, 25, 4.5, 23);
    case "li_pass_place": {
      const next = format(bound(layer, "locationFull"), 50, 57.5, 68, 12.2, 22);
      return { ...next, style: { ...next.style, lineHeight: 1.25 } };
    }
    default: return layer;
  }
}
function additions(template: TextLayer, existing: TextLayer[]): TextLayer[] {
  const make = (id: string, name: string, y: number, height: number, size: number, fields: ContentField[], text = "") =>
    format({ ...template, id, name, z: 8 + RIBBON_PASS_ADDED_IDS.indexOf(id), ...existing.find((l) => l.id === id),
      source: fields.length ? "content" : "static", fields, text }, 50, y, 68, height, size);
  return [
    make("rb_pass_title", "عنوان بطاقة الدخول", 15.5, 4.5, 24, [], "بطاقة الدخول"),
    make("rb_pass_guest", "اسم المدعو", 66.3, 5.1, 21, ["guestName"]),
    make("rb_pass_count", "عدد الأشخاص المسموح", 88, 4, 19, [], "عدد الأشخاص: {allowedCount}"),
  ];
}

type Proposal = { ok: true; layout: LayoutDoc } | { ok: false; reason: string };
/** Explicit, undoable pass-only proposal. No loader migration and no asset or QR edits. */
export function proposeRibbonPass(slug: string, doc: LayoutDoc, overrides: readonly LayoutOverrides[] = []): Proposal {
  const fail = (reason: string): Proposal => ({ ok: false, reason });
  if (slug !== RIBBON_THEME_SLUG) return fail("هذا التنسيق مخصص لفيونكة الورد.");
  const scenes = doc.scenes.filter((s) => s.id === "pass");
  if (scenes.length !== 1 || !scenes[0].visible || scenes[0].role !== "pass" || scenes[0].canvas.aspectW !== 900 || scenes[0].canvas.aspectH !== 1700 || scenes[0].canvas.safeInset > 6) {
    return fail("إعداد بطاقة الدخول أو مقاسها مخصص؛ يلزم مراجعته يدويًا.");
  }
  if (doc.layers.some((l) => l.scene === "pass" && !KNOWN_IDS.includes(l.id))) return fail("توجد عناصر إضافية في البطاقة؛ لم نغيّر ترتيبها.");
  if (overrides.some((o) => KNOWN_IDS.some((id) => o[id] && Object.keys(o[id]).some((k) => k !== "paint")))) return fail("أحد الألوان له ترتيب خاص في البطاقة؛ يلزم مراجعته.");
  for (const id of ["li_pass_card", "li_pass_qr", ...RIBBON_PASS_TEXT_IDS, ...RIBBON_PASS_ADDED_IDS.filter((id) => doc.layers.some((l) => l.id === id))]) {
    const matches = doc.layers.filter((l) => l.id === id);
    const layer = matches[0];
    if (matches.length !== 1 || layer.scene !== "pass" || !layer.visible || layer.locked ||
      layer.type !== (id === "li_pass_card" ? "asset" : id === "li_pass_qr" ? "qr" : "text")) return fail("إحدى طبقات البطاقة محذوفة أو مخفية أو مقفلة أو مخصصة؛ لم نستبدلها.");
    if ([layer.tablet, layer.desktop].some((v) => v && Object.keys(v).length)) return fail("توجد مواقع خاصة بمقاسات أخرى؛ لم نستبدلها.");
    if (layer.type === "asset" || layer.type === "qr") {
      const expected = layer.type === "asset" ? { x: 50, y: 50, width: 100, height: 100, scale: 1, rotation: 0, opacity: 1 }
        : { x: 49.41, y: 77.37, width: 21.6, height: 16.8, scale: 1, rotation: 0, opacity: 1 };
      if (Object.entries(expected).some(([key, value]) => layer.base[key as keyof typeof expected] !== value) ||
        (layer.type === "asset" && (layer.slot !== "card" || layer.fit !== "contain"))) return fail("موضع الصورة أو الرمز مخصص؛ يلزم مراجعته قبل ترتيب النصوص.");
    }
    if (layer.type === "text") {
      if (layer.desktopStyle && Object.keys(layer.desktopStyle).length) return fail("يوجد تنسيق مخصص للكمبيوتر؛ لم نستبدله.");
      const tablet = layer.tabletStyle;
      if (tablet && Object.keys(tablet).length && (Object.keys(tablet).length !== 1 || tablet.fontSize !== ORIGINAL_TABLET[id])) return fail("يوجد تنسيق مخصص للجهاز اللوحي؛ لم نستبدله.");
      const expected: Record<string, string[]> = {
        li_pass_invitation: ["invitationText"], li_pass_couple: ["coupleLine"], li_pass_godwilling: [],
        li_pass_place: ["locationFull"], li_pass_date: ["eventDateShort"], li_pass_time: ["eventTime"],
        rb_pass_title: [], rb_pass_guest: ["guestName"], rb_pass_count: [],
      };
      const originalText: Record<string, string> = {
        li_pass_couple: "{brideFirstName} & {groomFirstName}", li_pass_godwilling: "وذلك بمشيئة الله تعالى",
        li_pass_place: "المكان\n{locationFull}", li_pass_date: "التاريخ\n{eventDateShort}", li_pass_time: "الوقت\n{eventTime}",
        rb_pass_title: "بطاقة الدخول", rb_pass_count: "عدد الأشخاص: {allowedCount}",
      };
      const fields = expected[id];
      const isBound = fields.length > 0 && layer.source === "content" && JSON.stringify(layer.fields) === JSON.stringify(fields);
      const isStatic = layer.source === "static" && layer.fields.length === 0 && layer.text === originalText[id];
      if (!isBound && !isStatic) return fail("توجد نصوص أو روابط بيانات مخصصة في البطاقة؛ لم نستبدلها.");
    }
  }
  const template = doc.layers.find((l) => l.id === "li_pass_godwilling") as TextLayer;
  const added = additions(template, doc.layers.filter((l): l is TextLayer => l.type === "text" && RIBBON_PASS_ADDED_IDS.includes(l.id)));
  const layers = doc.layers.map((l) => {
    if (l.type !== "text") return l;
    if (RIBBON_PASS_TEXT_IDS.includes(l.id)) return polish(l);
    return added.find((a) => a.id === l.id) ?? l;
  });
  for (const layer of added) if (!layers.some((l) => l.id === layer.id)) layers.push(layer);
  return { ok: true, layout: { ...doc, layers } };
}
