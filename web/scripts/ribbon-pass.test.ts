import assert from "node:assert/strict";
import test from "node:test";
import snapshot from "../src/data/public-theme-catalog.snapshot.json";
import { proposeRibbonPass, RIBBON_PASS_ADDED_IDS, RIBBON_PASS_TEXT_IDS } from "../src/lib/themes/builder/ribbon-pass";
import { proposeRibbonGreeting, RIBBON_THEME_SLUG } from "../src/lib/themes/builder/ribbon-greeting";
import { proposeRibbonFlow } from "../src/lib/themes/builder/ribbon-flow";
import { assertLayoutDoc, parseLayoutDoc } from "../src/lib/themes/builder/schema";
import { resolveScene, type LayoutOverrides } from "../src/lib/themes/builder/resolve";
import { interpolate, resolveContent, SAMPLE_CONTENT_INPUT } from "../src/lib/themes/builder/content";
import type { LayoutDoc, TextLayer } from "../src/lib/themes/builder/types";

const variants = snapshot.filter((entry) => entry.config.family === RIBBON_THEME_SLUG);
const overrides = variants.map((entry) => entry.builder.overrides as LayoutOverrides);
const originalIds = [...RIBBON_PASS_TEXT_IDS, "li_pass_card", "li_pass_qr"];

function original(): LayoutDoc {
  let raw: unknown = variants[0].builder.layout;
  while (typeof raw === "string") {
    const match = /:themes:(\d+):builder:layout$/.exec(raw);
    assert.ok(match);
    raw = snapshot[Number(match[1])].builder.layout;
  }
  return parseLayoutDoc(assertLayoutDoc(structuredClone(raw)));
}

function proposed(doc = original(), paints: readonly LayoutOverrides[] = overrides): LayoutDoc {
  const result = proposeRibbonPass(RIBBON_THEME_SLUG, doc, paints);
  assert.ok(result.ok, result.ok ? "" : result.reason);
  return result.layout;
}

function approvedFlow(): LayoutDoc {
  const greeting = proposeRibbonGreeting(RIBBON_THEME_SLUG, original(), overrides);
  assert.ok(greeting.ok, greeting.ok ? "" : greeting.reason);
  const flow = proposeRibbonFlow(RIBBON_THEME_SLUG, greeting.layout, overrides);
  assert.ok(flow.ok, flow.ok ? "" : flow.reason);
  return flow.layout;
}

function textLayer(doc: LayoutDoc, id: string): TextLayer {
  const layer = doc.layers.find((entry) => entry.id === id);
  assert.equal(layer?.type, "text", id);
  return layer as TextLayer;
}

function roundTrip(doc: LayoutDoc): LayoutDoc {
  return parseLayoutDoc(assertLayoutDoc(JSON.parse(JSON.stringify(doc))));
}

function rendered(layer: TextLayer, content: ReturnType<typeof resolveContent>): string {
  return layer.source === "static"
    ? interpolate(layer.text, content)
    : layer.fields.map((field) => content[field]).filter(Boolean).join("\n");
}

test("pass proposal preserves the approved five flow scenes, greeting, cover, open and source input exactly", () => {
  for (const before of [original(), approvedFlow()]) {
    const frozen = structuredClone(before);
    const after = proposed(before);
    assert.deepEqual(before, frozen);
    assert.deepEqual({ ...after, layers: [] }, { ...before, layers: [] });
    assert.equal(after.layers.length, before.layers.length + RIBBON_PASS_ADDED_IDS.length);
    for (const layer of before.layers) {
      const next = after.layers.find((entry) => entry.id === layer.id);
      assert.ok(next);
      if (layer.scene !== "pass" || ["li_pass_card", "li_pass_qr"].includes(layer.id)) {
        assert.deepEqual(next, layer, layer.id);
        assert.equal(next, layer, `${layer.id}: untouched layer reference`);
      }
      if (layer.type === "text" && next.type === "text") {
        assert.equal(next.style.color, layer.style.color, `${layer.id}: original ink`);
      }
    }
    const added = after.layers.filter((entry) => RIBBON_PASS_ADDED_IDS.includes(entry.id));
    assert.equal(added.length, RIBBON_PASS_ADDED_IDS.length);
    assert.ok(added.every((entry) => entry.scene === "pass" && entry.type === "text" && entry.visible && !entry.locked));
  }
});

test("proposal and every palette preserve image/QR transforms, quiet-zone properties and variant paint", () => {
  const before = original();
  const custom: LayoutOverrides[] = variants.map((entry) => ({
    ...structuredClone(entry.builder.overrides as LayoutOverrides),
    li_pass_couple: { paint: { style: { color: "#123456" } } },
    rb_pass_guest: { paint: { style: { color: "#654321" } } },
    li_pass_qr: { paint: { fgColor: "#102030" } },
  }));
  const frozen = structuredClone(custom);
  const after = proposed(before, custom);
  assert.deepEqual(custom, frozen);
  variants.forEach((variant, index) => {
    for (const breakpoint of ["base", "tablet", "desktop"] as const) {
      const prior = resolveScene(before, "pass", breakpoint, custom[index], variant.builder.palette);
      const current = resolveScene(after, "pass", breakpoint, custom[index], variant.builder.palette);
      for (const id of ["li_pass_card", "li_pass_qr"]) {
        assert.deepEqual(current.find((entry) => entry.layer.id === id), prior.find((entry) => entry.layer.id === id));
      }
      for (const [id, color] of [["li_pass_couple", "#123456"], ["rb_pass_guest", "#654321"]]) {
        const layer = current.find((entry) => entry.layer.id === id)?.layer;
        assert.equal(layer?.type, "text");
        if (layer?.type === "text") assert.equal(layer.style.color, color);
      }
    }
  });
});

test("idempotence, JSON/schema round-trip and later manual editor changes retain all layer settings", () => {
  const first = proposed(approvedFlow());
  assert.deepEqual(proposed(first), first);
  assert.deepEqual(roundTrip(first), first);
  const manual = structuredClone(first);
  const guest = textLayer(manual, "rb_pass_guest");
  guest.style.font = "Tajawal";
  guest.style.fontSize = 23;
  guest.style.color = "#654321";
  guest.base.y = 62;
  guest.text = "دعوة خاصة إلى {guestName}";
  guest.source = "static";
  guest.fields = [];
  const count = textLayer(manual, "rb_pass_count");
  count.source = "content";
  count.fields = ["allowedCount"];
  count.text = "";
  assert.deepEqual(roundTrip(manual), manual);
});

test("reapplying the proposal does not recolor already-added guest/title/count text", () => {
  const before = proposed();
  for (const id of RIBBON_PASS_ADDED_IDS) textLayer(before, id).style.color = "#654321";
  const after = proposed(before);
  for (const id of RIBBON_PASS_ADDED_IDS) assert.equal(textLayer(after, id).style.color, "#654321", id);
});

test("rejects wrong theme and customized or ambiguous pass scenes", async (t) => {
  assert.equal(proposeRibbonPass("another-theme", original()).ok, false);
  const mutations: [string, (doc: LayoutDoc) => void][] = [
    ["missing scene", (doc) => { doc.scenes = doc.scenes.filter((entry) => entry.id !== "pass"); }],
    ["duplicate scene", (doc) => { doc.scenes.push(structuredClone(doc.scenes.find((entry) => entry.id === "pass")!)); }],
    ["hidden scene", (doc) => { doc.scenes.find((entry) => entry.id === "pass")!.visible = false; }],
    ["different role", (doc) => { doc.scenes.find((entry) => entry.id === "pass")!.role = "flow"; }],
    ["different canvas", (doc) => { doc.scenes.find((entry) => entry.id === "pass")!.canvas.aspectH = 1600; }],
    ["larger safe inset", (doc) => { doc.scenes.find((entry) => entry.id === "pass")!.canvas.safeInset = 20; }],
    ["extra pass layer", (doc) => { doc.layers.push({ ...textLayer(doc, "li_pass_couple"), id: "custom_pass_copy" }); }],
  ];
  for (const [name, mutate] of mutations) await t.test(name, () => {
    const doc = original();
    mutate(doc);
    const copy = structuredClone(doc);
    assert.equal(proposeRibbonPass(RIBBON_THEME_SLUG, doc, overrides).ok, false);
    assert.deepEqual(doc, copy);
  });
});

test("rejects missing, duplicated, relocated, hidden, locked and responsive pass layers", async (t) => {
  for (const id of originalIds) {
    const mutations: [string, (doc: LayoutDoc) => void][] = [
      ["missing", (doc) => { doc.layers = doc.layers.filter((entry) => entry.id !== id); }],
      ["duplicate", (doc) => { doc.layers.push(structuredClone(doc.layers.find((entry) => entry.id === id)!)); }],
      ["relocated", (doc) => { doc.layers.find((entry) => entry.id === id)!.scene = "greeting"; }],
      ["hidden", (doc) => { doc.layers.find((entry) => entry.id === id)!.visible = false; }],
      ["locked", (doc) => { doc.layers.find((entry) => entry.id === id)!.locked = true; }],
      ["tablet geometry", (doc) => { doc.layers.find((entry) => entry.id === id)!.tablet = { y: 40 }; }],
      ["desktop geometry", (doc) => { doc.layers.find((entry) => entry.id === id)!.desktop = { width: 55 }; }],
    ];
    for (const [kind, mutate] of mutations) await t.test(`${id}: ${kind}`, () => {
      const doc = original(); mutate(doc);
      assert.equal(proposeRibbonPass(RIBBON_THEME_SLUG, doc, overrides).ok, false);
    });
  }
  for (const id of RIBBON_PASS_TEXT_IDS) await t.test(`${id}: unknown responsive style`, () => {
    for (const key of ["tabletStyle", "desktopStyle"] as const) {
      const doc = original();
      textLayer(doc, id)[key] = { fontSize: 35, color: "#123456" };
      assert.equal(proposeRibbonPass(RIBBON_THEME_SLUG, doc, overrides).ok, false);
    }
  });
});

test("rejects custom dynamic bindings and static copy instead of silently replacing them", async (t) => {
  for (const id of [...RIBBON_PASS_TEXT_IDS, ...RIBBON_PASS_ADDED_IDS]) await t.test(id, () => {
    for (const source of ["static", "content"] as const) {
      const doc = RIBBON_PASS_ADDED_IDS.includes(id) ? proposed() : original();
      const layer = textLayer(doc, id);
      layer.source = source;
      layer.fields = source === "content" ? ["greeting"] : [];
      layer.text = "نص مخصص يجب ألا يُستبدل";
      assert.equal(proposeRibbonPass(RIBBON_THEME_SLUG, doc, overrides).ok, false);
    }
  });
});

test("rejects variant geometry even when it targets a not-yet-added pass text layer", async (t) => {
  for (const id of [...originalIds, ...RIBBON_PASS_ADDED_IDS]) await t.test(id, () => {
    assert.equal(proposeRibbonPass(RIBBON_THEME_SLUG, original(), [{ [id]: { y: 77 } }]).ok, false);
    assert.equal(proposeRibbonPass(RIBBON_THEME_SLUG, proposed(), [{ [id]: { width: 95 } }]).ok, false);
  });
});

test("refuses a moved QR or different card slot/fit instead of assuming the original reserved art zones", async (t) => {
  const mutations: [string, (doc: LayoutDoc) => void][] = [
    ["QR moved under names", (doc) => { doc.layers.find((entry) => entry.id === "li_pass_qr")!.base.y = 33; }],
    ["card moved", (doc) => { doc.layers.find((entry) => entry.id === "li_pass_card")!.base.y = 42; }],
    ["card slot changed", (doc) => { const layer = doc.layers.find((entry) => entry.id === "li_pass_card")!; if (layer.type === "asset") layer.slot = "envelopeOpen"; }],
    ["card fit changed", (doc) => { const layer = doc.layers.find((entry) => entry.id === "li_pass_card")!; if (layer.type === "asset") layer.fit = "cover"; }],
  ];
  for (const [name, mutate] of mutations) await t.test(name, () => {
    const doc = original(); mutate(doc);
    assert.equal(proposeRibbonPass(RIBBON_THEME_SLUG, doc, overrides).ok, false);
  });
});

test("coupleLine honors all selected formats and prints every couple without family names or baked-in samples", () => {
  const doc = proposed();
  const names = textLayer(doc, "li_pass_couple");
  assert.equal(names.source, "content");
  assert.deepEqual(names.fields, ["coupleLine"]);
  for (const coupleFormat of ["ALA", "WAW", "BRIDE_FOCUS"] as const) {
    const content = resolveContent({ ...SAMPLE_CONTENT_INPUT, coupleFormat, couples: Array.from({ length: 4 }, (_, i) => ({
      ...SAMPLE_CONTENT_INPUT.couples[0], groomNameAr: `عبدالرحمن عبدالعزيز ${i + 1}`, brideNameAr: `الجوهرة عبدالله ${i + 1}`,
      groomFamilyAr: "عائلة العريس", brideFamilyAr: "عائلة العروس",
    })) });
    const result = rendered(names, content);
    assert.equal(result, content.coupleLine);
    for (let i = 1; i <= 4; i++) {
      assert.ok(result.includes(`عبدالرحمن عبدالعزيز ${i}`));
      assert.ok(result.includes(`الجوهرة عبدالله ${i}`));
    }
    assert.ok(!result.includes("عائلة"));
    assert.equal(result.split("\n").length, coupleFormat === "BRIDE_FOCUS" ? 8 : 4);
    assert.ok(!JSON.stringify(doc).includes("عبدالرحمن عبدالعزيز"));
  }
});

test("guest name/count, optional copy, date/time and location resolve from current invitation data", () => {
  const doc = proposed();
  const guest = textLayer(doc, "rb_pass_guest");
  const count = textLayer(doc, "rb_pass_count");
  for (const allowedCount of [1, 2, 7, 25]) {
    const content = resolveContent({ ...SAMPLE_CONTENT_INPUT, guestName: "الضيفة صاحبة الاسم الطويل", allowedCount,
      invitationTextAr: "كلمة خاصة من أصحاب المناسبة", locationName: "قاعة الاحتفالات الكبرى — المدخل الشرقي" });
    assert.equal(rendered(guest, content), content.guestName);
    assert.equal(rendered(count, content), `عدد الأشخاص: ${allowedCount}`);
    assert.equal(rendered(textLayer(doc, "li_pass_invitation"), content), content.invitationText);
    assert.equal(rendered(textLayer(doc, "li_pass_date"), content), content.eventDateShort);
    assert.equal(rendered(textLayer(doc, "li_pass_time"), content), content.eventTime);
    assert.equal(rendered(textLayer(doc, "li_pass_place"), content), content.locationFull);
  }
  for (const allowedCount of [undefined, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    const content = resolveContent({ ...SAMPLE_CONTENT_INPUT, allowedCount, invitationTextAr: "" });
    assert.equal(content.allowedCount, "");
    assert.equal(rendered(count, content), "عدد الأشخاص: ");
    assert.equal(rendered(textLayer(doc, "li_pass_invitation"), content), "");
  }
});
