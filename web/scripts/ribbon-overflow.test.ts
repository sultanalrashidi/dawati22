import assert from "node:assert/strict";
import test from "node:test";
import { assertLayoutDoc, layerSchema, parseLayoutDoc } from "../src/lib/themes/builder/schema";
import { starterLayoutDoc } from "../src/lib/themes/builder/starter-layout";
import type { Layer, LayoutDoc } from "../src/lib/themes/builder/types";

type ScrollingLayer = Extract<Layer, { type: "rsvp" | "schedule" | "notes" }>;
const isScrollingLayer = (layer: Layer): layer is ScrollingLayer =>
  layer.type === "rsvp" || layer.type === "schedule" || layer.type === "notes";
const roundTrip = (doc: LayoutDoc) => parseLayoutDoc(assertLayoutDoc(JSON.parse(JSON.stringify(doc))));

test("existing layers remain unchanged with no opt-in default added", () => {
  const doc = starterLayoutDoc();
  assert.deepEqual(roundTrip(doc), doc);
  const composites = doc.layers.filter(isScrollingLayer);
  assert.equal(composites.length, 3);
  for (const layer of composites) {
    assert.equal(Object.hasOwn(layerSchema.parse(layer), "overflow"), false);
  }
});

test("all three composite layers preserve the option and manual edits through save/read", () => {
  const doc = starterLayoutDoc();
  for (const layer of doc.layers.filter(isScrollingLayer)) {
    layer.overflow = "scroll";
    layer.title = "عنوان عدّلته يدويًا";
    layer.base.height = 32;
  }
  assert.deepEqual(roundTrip(doc), doc);
  for (const layer of doc.layers.filter(isScrollingLayer)) layer.overflow = undefined;
  const restored = roundTrip(doc);
  for (const layer of restored.layers.filter(isScrollingLayer)) {
    assert.equal(Object.hasOwn(layer, "overflow"), false);
    assert.equal(layer.title, "عنوان عدّلته يدويًا");
    assert.equal(layer.base.height, 32);
  }
});

test("only scroll is accepted, and non-composite layers gain no overflow setting", () => {
  for (const layer of starterLayoutDoc().layers) {
    if (isScrollingLayer(layer)) {
      for (const overflow of ["hidden", "auto", false, null]) {
        assert.equal(layerSchema.safeParse({ ...layer, overflow }).success, false);
      }
    } else {
      assert.equal(Object.hasOwn(layerSchema.parse({ ...layer, overflow: "scroll" }), "overflow"), false);
    }
  }
});
