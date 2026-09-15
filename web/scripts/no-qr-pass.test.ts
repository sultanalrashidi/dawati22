import assert from "node:assert/strict";
import test from "node:test";
import reference from "../src/data/jasmine-reference.layout.json";
import snapshot from "../src/data/public-theme-catalog.snapshot.json";
import { copyLayerOverrides, passSceneFor, withNoQrPass, NO_QR_PASS_NAME } from "../src/lib/themes/builder/no-qr-pass";
import { assertLayoutDoc, parseLayoutDoc } from "../src/lib/themes/builder/schema";
import { resolveScene, type LayoutOverrides } from "../src/lib/themes/builder/resolve";
import { BREAKPOINTS, DEFAULT_PALETTE, type LayoutDoc, type SceneDef } from "../src/lib/themes/builder/types";

const jasmine = (): LayoutDoc => parseLayoutDoc(structuredClone(reference.layout));

/** The snapshot stores repeated documents once and points at them by path. */
function resolveRef(raw: unknown): unknown {
  let value = raw;
  while (typeof value === "string") {
    const match = /:themes:(\d+):builder:layout$/.exec(value);
    assert.ok(match, `unexpected reference ${value}`);
    value = (snapshot[Number(match[1])].builder as { layout: unknown }).layout;
  }
  return value;
}

function created(doc: LayoutDoc) {
  const copy = withNoQrPass(doc);
  assert.ok(!("error" in copy), "expected a copy");
  return copy;
}

test("the copy is the pass without its code, on a scene of its own at the end", () => {
  const doc = jasmine();
  const copy = created(doc);
  const pass = doc.scenes.find((scene) => scene.role === "pass")!;
  const scene = copy.doc.scenes.at(-1)!;

  assert.equal(copy.sceneId, "passNoQr");
  assert.deepEqual(scene, { id: "passNoQr", name: NO_QR_PASS_NAME, role: "passNoQr", canvas: pass.canvas, visible: true, requires: null });
  assert.deepEqual(copy.doc.scenes.slice(0, -1), doc.scenes);

  const source = doc.layers.filter((layer) => layer.scene === pass.id);
  const copies = copy.doc.layers.filter((layer) => layer.scene === copy.sceneId);
  assert.deepEqual(copies.map((layer) => layer.type).sort(), source.filter((l) => l.type !== "qr").map((l) => l.type).sort());
  assert.ok(copies.every((layer) => layer.id.endsWith("-noqr")));
  assert.equal(copy.layerIds.size, copies.length);
  // The card keeps its slot, so a colour without "cardNoQr" art still shows a card.
  assert.ok(copies.some((layer) => layer.type === "asset" && layer.slot === "card"));
  // Nothing already there is touched.
  assert.deepEqual(copy.doc.layers.slice(0, doc.layers.length), doc.layers);
  assert.equal(new Set(copy.doc.layers.map((layer) => layer.id)).size, copy.doc.layers.length);
});

test("the copied document is valid and keeps its shape through a save and a reload", () => {
  const copy = created(jasmine());
  const saved = assertLayoutDoc(JSON.parse(JSON.stringify(copy.doc)));
  const reloaded = parseLayoutDoc(saved);
  assert.deepEqual(reloaded.scenes, copy.doc.scenes);
  assert.equal(reloaded.layers.length, copy.doc.layers.length);
});

test("until it is rearranged, the copy draws exactly the automatic no-barcode card", () => {
  const doc = jasmine();
  const copy = created(doc);
  for (const breakpoint of BREAKPOINTS) {
    const before = resolveScene(doc, "pass", breakpoint, {}, DEFAULT_PALETTE).filter((entry) => entry.layer.type !== "qr");
    const after = resolveScene(copy.doc, copy.sceneId, breakpoint, {}, DEFAULT_PALETTE);
    assert.deepEqual(
      after.map((entry) => ({ ...entry, layer: { ...entry.layer, id: "", scene: "" } })),
      before.map((entry) => ({ ...entry, layer: { ...entry.layer, id: "", scene: "" } })),
      breakpoint,
    );
  }
});

test("a colour's own nudges on its pass follow onto the copy", () => {
  // The catalogue's colours that moved something on their pass.
  const nudged = snapshot.filter((entry) => {
    const overrides = (entry.builder?.overrides ?? {}) as LayoutOverrides;
    return Object.keys(overrides).some((id) => id.startsWith("li_pass_") && overrides[id]);
  });
  assert.ok(nudged.length > 0, "expected a colour with pass overrides in the snapshot");

  for (const entry of nudged) {
    const doc = parseLayoutDoc(resolveRef(entry.builder!.layout));
    const overrides = entry.builder!.overrides as LayoutOverrides;
    const copy = created(doc);
    const copied = copyLayerOverrides(overrides, copy.layerIds);
    assert.ok(copied, entry.slug);
    for (const breakpoint of BREAKPOINTS) {
      const before = resolveScene(doc, "pass", breakpoint, overrides, DEFAULT_PALETTE).filter((e) => e.layer.type !== "qr");
      const after = resolveScene(copy.doc, copy.sceneId, breakpoint, copied, DEFAULT_PALETTE);
      assert.deepEqual(after.map((e) => e.transform), before.map((e) => e.transform), `${entry.slug} ${breakpoint}`);
    }
  }
});

test("a colour with nothing on its pass has nothing to write", () => {
  const copy = created(jasmine());
  assert.equal(copyLayerOverrides({}, copy.layerIds), null);
  assert.equal(copyLayerOverrides({ some_other_layer: { x: 10 } }, copy.layerIds), null);
});

test("refused when there already is one, when there is no pass, and at the limits", () => {
  const once = created(jasmine());
  assert.deepEqual(withNoQrPass(once.doc), { error: "exists" });

  const noPass = jasmine();
  noPass.scenes = noPass.scenes.filter((scene) => scene.role !== "pass");
  assert.deepEqual(withNoQrPass(noPass), { error: "noPass" });

  const fullScenes = jasmine();
  while (fullScenes.scenes.length < 30) {
    fullScenes.scenes.splice(1, 0, { ...fullScenes.scenes[1], id: `s_${fullScenes.scenes.length}` });
  }
  assert.deepEqual(withNoQrPass(fullScenes), { error: "full" });

  const fullLayers = jasmine();
  const filler = fullLayers.layers.find((layer) => layer.scene === "cover")!;
  while (fullLayers.layers.length < 118) fullLayers.layers.push({ ...filler, id: `f_${fullLayers.layers.length}` });
  assert.deepEqual(withNoQrPass(fullLayers), { error: "full" });
});

test("ids stay free of collisions and inside the schema's length", () => {
  const doc = jasmine();
  const card = doc.layers.find((layer) => layer.id === "li_pass_card")!;
  doc.layers.push({ ...card, id: "li_pass_card-noqr", scene: "open" });
  doc.scenes.splice(1, 0, { ...doc.scenes[1], id: "passNoQr" });
  const long = { ...card, id: "x".repeat(64) };
  doc.layers.push(long);

  const copy = created(doc);
  assert.equal(copy.sceneId, "passNoQr2");
  assert.equal(copy.layerIds.get("li_pass_card"), "li_pass_card-noqr2");
  assert.ok(copy.layerIds.get(long.id)!.length <= 64);
  assertLayoutDoc(JSON.parse(JSON.stringify(copy.doc)));
});

test("which pass a guest is shown", () => {
  const withBoth = created(jasmine()).doc;
  const pass = (doc: LayoutDoc, hasQr: boolean) => passSceneFor(doc, hasQr)?.id;

  assert.equal(pass(withBoth, true), "pass");
  assert.equal(pass(withBoth, false), "passNoQr");

  const hidden = structuredClone(withBoth);
  hidden.scenes.find((scene) => scene.role === "passNoQr")!.visible = false;
  assert.equal(pass(hidden, false), "pass", "hiding the no-barcode card goes back to the automatic one");

  assert.equal(pass(jasmine(), false), "pass", "a design without one keeps today's behaviour");

  const onlyNoQr = structuredClone(withBoth);
  onlyNoQr.scenes.find((scene) => scene.role === "pass")!.visible = false;
  assert.equal(pass(onlyNoQr, true), undefined);
  assert.equal(pass(onlyNoQr, false), "passNoQr");
});

test("a stored list is put back in order, and a second no-barcode card never reaches the scroll", () => {
  const doc = created(jasmine()).doc;
  const noQr = doc.scenes.pop()!;
  doc.scenes.splice(2, 0, noQr);
  const duplicate: SceneDef = { ...noQr, id: "another" };
  doc.scenes.splice(3, 0, duplicate);

  const scenes = parseLayoutDoc(doc).scenes;
  assert.equal(scenes.at(-1)!.id, "passNoQr");
  assert.equal(scenes.at(-2)!.role, "pass");
  const demoted = scenes.find((scene) => scene.id === "another")!;
  assert.equal(demoted.role, "flow");
  assert.equal(demoted.visible, false);
});
