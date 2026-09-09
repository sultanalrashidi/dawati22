import assert from "node:assert/strict";
import test from "node:test";
import ar from "../src/lib/i18n/dictionaries/ar.json";
import { toRiyadhDateTimeLocal } from "../src/lib/dates";
import { composeWeddingName } from "../src/lib/events/event-name";
import {
  SAMPLE_BRIDE_MOTHER,
  SAMPLE_COUPLE,
  SAMPLE_DAYS_AHEAD,
  SAMPLE_EVENT_NAME,
  SAMPLE_GROOM_MOTHER,
  SAMPLE_SCHEDULE,
  SAMPLE_VENUE,
  isUntouchedSample,
  sampleEventDate,
  usesSampleNames,
} from "../src/lib/drafts/sample";

test("the sample wedding is 60 days ahead at 21:00 Riyadh", () => {
  const now = new Date("2026-09-09T05:00:00.000Z");
  const local = toRiyadhDateTimeLocal(sampleEventDate(now));
  assert.ok(local.endsWith("T21:00"), local);
  const expectedDay = toRiyadhDateTimeLocal(
    new Date(now.getTime() + SAMPLE_DAYS_AHEAD * 86_400_000),
  ).slice(0, 10);
  assert.equal(local.slice(0, 10), expectedDay);
  assert.equal(sampleEventDate(now).toISOString(), `${expectedDay}T18:00:00.000Z`);
});

test("the event name is composed groom first", () => {
  assert.equal(SAMPLE_EVENT_NAME, "حفل زفاف فهد و نورة");
  assert.equal(
    composeWeddingName([{ ...SAMPLE_COUPLE, groomNameAr: " محمد ", brideNameAr: "سارة" }]),
    "حفل زفاف محمد و سارة",
  );
});

test("usesSampleNames only matches the sample given names", () => {
  assert.equal(usesSampleNames([SAMPLE_COUPLE]), true);
  assert.equal(usesSampleNames([{ groomNameAr: " فهد ", brideNameAr: "نورة " }]), true, "whitespace");
  // A CoupleInput, not a bare pair: the guard reads the given names off the
  // wider row shape too, and changing only the family must not lift it.
  const familyChanged = { ...SAMPLE_COUPLE, groomFamilyAr: "العتيبي" };
  assert.equal(usesSampleNames([familyChanged]), true, "family alone is not a change");
  assert.equal(usesSampleNames([{ groomNameAr: "محمد", brideNameAr: "نورة" }]), false);
  assert.equal(usesSampleNames([{ groomNameAr: "فهد", brideNameAr: "سارة" }]), false);
  assert.equal(usesSampleNames([{ groomNameAr: null, brideNameAr: null }]), false);
  assert.equal(usesSampleNames([]), false);
  assert.equal(
    usesSampleNames([{ groomNameAr: "محمد", brideNameAr: "سارة" }, SAMPLE_COUPLE]),
    true,
    "any couple",
  );
  assert.equal(usesSampleNames([{ ...SAMPLE_COUPLE, groomNameAr: "محمد" }]), false);
});

test("the sample carries no English names, and the mothers are not the preview guest", () => {
  assert.equal(SAMPLE_COUPLE.groomNameEn, "");
  assert.equal(SAMPLE_COUPLE.brideNameEn, "");
  assert.notEqual(SAMPLE_GROOM_MOTHER, ar.draft.previewGuestName);
  assert.notEqual(SAMPLE_BRIDE_MOTHER, ar.draft.previewGuestName);
});

test("the programme survives the label|time textarea format", () => {
  assert.equal(SAMPLE_SCHEDULE.length, 3);
  for (const item of SAMPLE_SCHEDULE) {
    assert.ok(item.labelAr && item.time);
    assert.ok(!item.labelAr.includes("|") && !item.time.includes("|"));
  }
});

test("only a wholly untouched draft is refused a payment", () => {
  // The case the guard exists for: she never opened the form.
  assert.equal(isUntouchedSample([SAMPLE_COUPLE], SAMPLE_VENUE), true);

  // A real couple who happen to be called فهد and نورة. They warned her, but
  // by the time she reaches payment she has a hall of her own, so she pays.
  assert.equal(
    isUntouchedSample([{ ...SAMPLE_COUPLE, groomFamilyAr: "العتيبي" }], SAMPLE_VENUE),
    false,
    "own family name",
  );
  assert.equal(isUntouchedSample([SAMPLE_COUPLE], "قاعة الماسة"), false, "own venue");
  assert.equal(usesSampleNames([SAMPLE_COUPLE]), true, "she is still warned in both cases");

  assert.equal(isUntouchedSample([], SAMPLE_VENUE), false);
});
