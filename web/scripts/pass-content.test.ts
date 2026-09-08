import assert from "node:assert/strict";
import test from "node:test";
import { interpolate, resolveContent, SAMPLE_CONTENT_INPUT, type InvitationContentInput } from "../src/lib/themes/builder/content";
import { assertLayoutDoc, parseLayoutDoc } from "../src/lib/themes/builder/schema";
import { starterLayoutDoc } from "../src/lib/themes/builder/starter-layout";
import { CONTENT_FIELD_LABELS_AR, CONTENT_FIELDS } from "../src/lib/themes/builder/types";

test("capacity is a dynamic field with an Arabic editor label", () => {
  assert.ok(CONTENT_FIELDS.includes("allowedCount"));
  assert.equal(CONTENT_FIELD_LABELS_AR.allowedCount, "عدد المقاعد المسموح بها");
  for (const allowedCount of [1, 2, 8, 250]) {
    const content = resolveContent({ ...SAMPLE_CONTENT_INPUT, allowedCount });
    assert.equal(content.allowedCount, String(allowedCount));
    assert.equal(interpolate("عدد المقاعد: {allowedCount}", content), `عدد المقاعد: ${allowedCount}`);
  }
});

test("missing, zero and invalid capacities resolve empty without a sample fallback", () => {
  const missing = { ...SAMPLE_CONTENT_INPUT };
  delete missing.allowedCount;
  assert.equal(resolveContent(missing).allowedCount, "");
  for (const allowedCount of [undefined, 0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, null, "2", true]) {
    const input = { ...missing, allowedCount } as unknown as InvitationContentInput;
    const content = resolveContent(input);
    assert.equal(content.allowedCount, "", `invalid capacity ${String(allowedCount)}`);
    assert.equal(interpolate("{allowedCount}", content), "");
  }
});

test("multiple couples keep their order and given names only on a pass", () => {
  const content = resolveContent({
    ...SAMPLE_CONTENT_INPUT,
    allowedCount: 4,
    couples: [
      { groomNameAr: "عبدالعزيز", brideNameAr: "نورة", groomFamilyAr: "عائلة أولى", brideFamilyAr: "عائلة ثانية", groomNameEn: "", brideNameEn: "" },
      { groomNameAr: "عبدالرحمن", brideNameAr: "الجوهرة", groomFamilyAr: "عائلة ثالثة", brideFamilyAr: "عائلة رابعة", groomNameEn: "", brideNameEn: "" },
    ],
  });
  assert.equal(interpolate("{groomFirstName} و {brideFirstName}", content), "عبدالعزيز و نورة\nعبدالرحمن و الجوهرة");
  assert.equal(content.perCouple.length, 2);
  assert.equal(interpolate("{allowedCount}", content), "4");
  assert.equal(interpolate("{guestName}", content), SAMPLE_CONTENT_INPUT.guestName);
});

test("capacity bindings survive document save/read without rewriting other fields or data", () => {
  const doc = starterLayoutDoc();
  const before = structuredClone(doc);
  const layer = doc.layers.find((entry) => entry.type === "text" && entry.scene === "pass");
  assert.ok(layer?.type === "text");
  layer.source = "content";
  layer.fields = ["guestName", "allowedCount"];
  const restored = parseLayoutDoc(assertLayoutDoc(JSON.parse(JSON.stringify(doc))));
  assert.deepEqual(restored, doc);
  for (const original of before.layers) {
    if (original.id !== layer.id) assert.deepEqual(restored.layers.find((entry) => entry.id === original.id), original);
  }
  assert.deepEqual({ ...restored, layers: [] }, { ...before, layers: [] });
  assert.ok(!JSON.stringify(doc).includes(SAMPLE_CONTENT_INPUT.guestName));
});
