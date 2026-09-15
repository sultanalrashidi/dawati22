import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { composeWeddingName, eventNameFor } from "../src/lib/events/event-name";
import type { CoupleInput } from "../src/lib/themes/builder/content";

/**
 * The event's name used to be typed into a field of its own on three of the
 * four forms that write it, so renaming the groom in the admin corrected him
 * everywhere the couple is printed and left `Event.name` on the old name — and
 * `Event.name` is exactly what the calendar file and the Apple/Google passes
 * carry. A wedding is now named after its couple wherever it is saved.
 */

function couple(groom: string, bride: string): CoupleInput {
  return {
    groomNameEn: "",
    brideNameEn: "",
    groomNameAr: groom,
    groomFamilyAr: null,
    brideNameAr: bride,
    brideFamilyAr: null,
  };
}

const MAJED = [couple("ماجد", "لمى")];
const AHMED = [couple("أحمد", "لمى")];

test("a wedding is named after its couple, whatever the form posted", () => {
  // The admin form used to post the name it was rendered with — the old one.
  assert.equal(
    eventNameFor({ isWedding: true, couples: AHMED, typed: composeWeddingName(MAJED) }),
    "حفل زفاف أحمد و لمى",
  );
  // And with nothing posted at all, which is what the forms do now.
  assert.equal(eventNameFor({ isWedding: true, couples: AHMED, typed: "" }), "حفل زفاف أحمد و لمى");
  assert.equal(eventNameFor({ isWedding: true, couples: MAJED, typed: "" }), "حفل زفاف ماجد و لمى");
});

test("the English names stand in when the Arabic ones are absent", () => {
  const latin: CoupleInput = {
    groomNameEn: "Majed",
    brideNameEn: "Lama",
    groomNameAr: null,
    groomFamilyAr: null,
    brideNameAr: null,
    brideFamilyAr: null,
  };
  assert.equal(eventNameFor({ isWedding: true, couples: [latin], typed: "" }), "حفل زفاف Majed و Lama");
});

test("another occasion keeps the name that was typed", () => {
  // There is no couple to compose from, and "حفل زفاف" is not a graduation.
  assert.equal(eventNameFor({ isWedding: false, couples: [], typed: "حفل تخرج نورة" }), "حفل تخرج نورة");
  assert.equal(eventNameFor({ isWedding: false, couples: AHMED, typed: "حفل تخرج نورة" }), "حفل تخرج نورة");
});

test("a couple-less submission falls back to the typed name rather than throwing", () => {
  // composeWeddingName reads couples[0]; readEventForm rejects the submission
  // for its own reasons, and must get there instead of crashing here.
  assert.equal(eventNameFor({ isWedding: true, couples: [], typed: "أي شيء" }), "أي شيء");
});

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the one reader of the form composes the name, and no form asks for one", () => {
  const form = source("src/lib/events/form.ts");
  assert.match(form, /eventNameFor\(\{\s*isWedding: type === EventType\.WEDDING/);
  // The option that used to switch this on per caller is gone: one rule.
  assert.doesNotMatch(form, /composeName/);

  // Every page that renders the shared field block for a wedding hides the
  // name input. A field that is rendered is a field that is posted, and a
  // posted name is the copy that drifted.
  for (const page of [
    "src/app/[locale]/draft/[eventId]/details/page.tsx",
    "src/app/[locale]/events/new/page.tsx",
    "src/app/[locale]/events/[eventId]/details/page.tsx",
  ]) {
    assert.match(source(page), /hideName/, page);
  }
  // Support's form keeps it for the occasions that have no couple.
  assert.match(
    source("src/app/[locale]/admin/events/[eventId]/page.tsx"),
    /hideName=\{event\.type === EventType\.WEDDING\}/,
  );
});

test("the calendar file and the wallet passes still read the composed name", () => {
  // The whole point of composing it: these three print `Event.name` itself,
  // not the couple, so they are the places a stale name was visible.
  assert.match(source("src/app/i/[token]/calendar/route.ts"), /SUMMARY:\$\{escapeIcsText\(event\.name\)\}/);
  assert.match(source("src/lib/wallet/apple.ts"), /label: "المناسبة", value: event\.name/);
  assert.match(source("src/lib/wallet/google.ts"), /eventName: \{ defaultValue: \{ language: "ar", value: event\.name \} \}/);
});
