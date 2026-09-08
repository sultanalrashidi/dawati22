import assert from "node:assert/strict";
import test from "node:test";
import snapshot from "../src/data/public-theme-catalog.snapshot.json";
import { proposeRibbonFlow, RIBBON_FLOW_IDS, RIBBON_FLOW_SCENES } from "../src/lib/themes/builder/ribbon-flow";
import { RIBBON_THEME_SLUG } from "../src/lib/themes/builder/ribbon-greeting";
import { assertLayoutDoc, parseLayoutDoc } from "../src/lib/themes/builder/schema";
import { resolveScene, type LayoutOverrides } from "../src/lib/themes/builder/resolve";
import type { LayoutDoc } from "../src/lib/themes/builder/types";

const variants = snapshot.filter((item) => item.config.family === RIBBON_THEME_SLUG);
function original(): LayoutDoc {
  let raw: unknown = variants[0].builder.layout;
  while (typeof raw === "string") {
    const match = /:themes:(\d+):builder:layout$/.exec(raw);
    assert.ok(match);
    raw = snapshot[Number(match[1])].builder.layout;
  }
  return parseLayoutDoc(assertLayoutDoc(structuredClone(raw)));
}
function proposed(doc = original()) {
  const result = proposeRibbonFlow(RIBBON_THEME_SLUG, doc, variants.map((item) => item.builder.overrides as LayoutOverrides));
  assert.ok(result.ok, result.ok ? "" : result.reason);
  return result.layout;
}
test("changes only the ten requested layers, preserving all other scenes, text, colors, data and actions", () => {
  const before = original();
  const copy = structuredClone(before);
  const after = proposed(before);
  assert.deepEqual(before, copy);
  assert.deepEqual({ ...after, layers: [] }, { ...before, layers: [] });
  assert.equal(after.layers.length, before.layers.length);
  before.layers.forEach((layer, index) => {
    const next = after.layers[index];
    if (!RIBBON_FLOW_IDS.includes(layer.id)) return assert.deepEqual(next, layer);
    for (const [key, value] of Object.entries(layer)) {
      if (["base", "style", "titleStyle", "numberStyle", "labelStyle", "itemStyle", "fieldStyle", "timeStyle", "borderRadius", "rowGap", "overflow"].includes(key)) {
        if (typeof value === "object" && value && "color" in value) assert.equal((next as unknown as Record<string, { color: string }>)[key].color, value.color);
      } else assert.deepEqual((next as unknown as Record<string, unknown>)[key], value, `${layer.id}.${key}`);
    }
  });
});
test("proposal is idempotent and round-trips through stored schema without implicit reapplication", () => {
  const next = proposed();
  assert.deepEqual(proposed(next), next);
  const roundTrip = (doc: LayoutDoc) => parseLayoutDoc(assertLayoutDoc(JSON.parse(JSON.stringify(doc))));
  assert.deepEqual(roundTrip(next), next);
  const layer = next.layers.find((item) => item.type === "notes")!;
  if (layer.type !== "notes") return;
  layer.itemStyle.font = "Tajawal"; layer.itemStyle.fontSize = 22; layer.base.y = 44;
  delete layer.overflow;
  assert.deepEqual(roundTrip(next), next);
});
test("all five palettes resolve while variant overrides remain untouched", () => {
  const source = structuredClone(variants);
  for (const variant of variants) {
    for (const scene of RIBBON_FLOW_SCENES) {
      const layers = resolveScene(proposed(), scene, "base", variant.builder.overrides as LayoutOverrides, variant.builder.palette);
      assert.ok(layers.length);
      layers.forEach((item) => assert.equal(item.transform.x, 50));
    }
  }
  assert.deepEqual(variants, source);
});
test("refuses hidden, missing, locked, extra, responsive, relocated and custom-bound layers", () => {
  assert.equal(proposeRibbonFlow("another-theme", original()).ok, false);
  const mutations: ((doc: LayoutDoc) => void)[] = [
    (doc) => { doc.scenes.find((s) => s.id === "notes")!.visible = false; },
    (doc) => { doc.scenes.find((s) => s.id === "rsvp")!.canvas.safeInset = 10; },
    (doc) => { doc.layers = doc.layers.filter((l) => l.id !== "f_countdown"); },
    (doc) => { doc.layers.find((l) => l.id === "f_countdown")!.locked = true; },
    (doc) => { doc.layers.find((l) => l.id === "f_schedule")!.tablet = { y: 20 }; },
    (doc) => { const l = doc.layers.find((l) => l.id === "f_notes")!; doc.layers.push({ ...l, id: "custom_notes" }); },
    (doc) => { const l = doc.layers.find((l) => l.id === "f_details_when")!; if (l.type === "text") l.fields = ["guestName"]; },
    (doc) => { const l = doc.layers.find((l) => l.id === "f_details_map")!; if (l.type === "button") l.action = "link"; },
  ];
  mutations.forEach((mutate) => { const doc = original(); mutate(doc); assert.equal(proposeRibbonFlow(RIBBON_THEME_SLUG, doc).ok, false); });
  assert.equal(proposeRibbonFlow(RIBBON_THEME_SLUG, original(), [{ f_notes: { width: 55 } }]).ok, false);
  assert.equal(proposeRibbonFlow(RIBBON_THEME_SLUG, original(), [{ f_notes: { paint: { itemStyle: { color: "#123456" } } } }]).ok, true);
});
test("detail boxes do not overlap and remain inside the original safe area", () => {
  const boxes = proposed().layers.filter((l) => l.scene === "details").map((l) => l.base).sort((a, b) => a.y - b.y);
  boxes.forEach((box, i) => {
    assert.ok(box.y - box.height! / 2 >= 6);
    assert.ok(box.y + box.height! / 2 <= 94);
    if (i) assert.ok(box.y - box.height! / 2 > boxes[i - 1].y + boxes[i - 1].height! / 2);
  });
});
