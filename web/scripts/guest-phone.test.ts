import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGuestPhone } from "../src/lib/security/phone";
import { parseGuestList } from "../src/lib/guests/import-parse";

test("a Saudi number reads the same in every shape it is written in", () => {
  for (const input of [
    "0591715728",
    "591715728",
    "966591715728",
    "+966591715728",
    "00966591715728",
    "+966 59 171 5728",
    "٠٥٩١٧١٥٧٢٨",
  ]) {
    assert.equal(normalizeGuestPhone(input), "+966591715728", input);
  }
});

test("a number from abroad reads when it carries its country code", () => {
  assert.equal(normalizeGuestPhone("+96550123456"), "+96550123456");
  assert.equal(normalizeGuestPhone("0096550123456"), "+96550123456");
  assert.equal(normalizeGuestPhone("96550123456"), "+96550123456");
  assert.equal(normalizeGuestPhone("+971501234567"), "+971501234567");
  assert.equal(normalizeGuestPhone("+20 101 234 5678"), "+201012345678");
  // Outside the country list: taken as written, but only after a + or 00.
  assert.equal(normalizeGuestPhone("+447911123456"), "+447911123456");
  assert.equal(normalizeGuestPhone("447911123456"), null);
});

test("a local number from abroad is never guessed at", () => {
  // An Egyptian mobile, and also Riyadh's landline code.
  assert.equal(normalizeGuestPhone("01012345678"), null);
  // Kuwaiti or Qatari — which is not ours to pick.
  assert.equal(normalizeGuestPhone("50123456"), null);
  // A listed code with a number too short for that country.
  assert.equal(normalizeGuestPhone("+965123"), null);
});

test("the import keeps the seat count next to a number from abroad", () => {
  const [kuwait, saudiSpaced, egyptLocal] = parseGuestList(
    ["خالتي هيا +965 5012 3456 2", "ريم +966 50 111 2255", "سارة، 01012345678"].join("\n"),
  );
  assert.equal(kuwait.phone, "+96550123456");
  assert.equal(kuwait.allowedCount, 2);
  assert.equal(saudiSpaced.phone, "+966501112255");
  assert.equal(saudiSpaced.allowedCount, 1);
  assert.equal(egyptLocal.phone, null);
  assert.equal(egyptLocal.status, "badPhone");
});
