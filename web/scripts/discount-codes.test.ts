import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDiscountCode,
  codeRefusal,
  discountHalalas,
  isDiscountRefusal,
  isValidCodeFormat,
  normalizeCode,
} from "../src/lib/discounts/rules";
import { totalHalalas } from "../src/lib/orders/pricing";

const NOW = new Date("2026-09-15T12:00:00Z");

test("what a customer types is folded to the stored shape", () => {
  assert.equal(normalizeCode(" watani 96 "), "WATANI96");
  assert.equal(normalizeCode("watani٩٦"), "WATANI96");
  assert.equal(normalizeCode("sa-۲۰"), "SA-20");
  assert.ok(isValidCodeFormat("WATANI96"));
  assert.ok(!isValidCodeFormat("AB"));
  assert.ok(!isValidCodeFormat("وطني96"));
  assert.ok(!isValidCodeFormat("A".repeat(21)));
});

test("a percent code takes its share, in whole halalas", () => {
  // 100 invitations at the National Day price of 2 SAR, 20% off → 40 SAR.
  const subtotal = totalHalalas(100, 2);
  assert.equal(discountHalalas(subtotal, "PERCENT", 20), 4000);
  // 25 × 2.75 = 68.75; 15% = 10.3125 → 10.31.
  assert.equal(discountHalalas(totalHalalas(25, 2.75), "PERCENT", 15), 1031);
});

test("a fixed code never takes more than the order", () => {
  assert.equal(discountHalalas(totalHalalas(100, 2), "FIXED", 50), 5000);
  assert.equal(discountHalalas(totalHalalas(25, 1), "FIXED", 50), 2500);
});

test("a remainder under one riyal is waived, making the order free", () => {
  // 25 × 1 = 25 SAR; 24.50 off would leave 0.50, which no card can pay.
  assert.equal(discountHalalas(2500, "FIXED", 24.5), 2500);
  // Exactly one riyal left is chargeable and is charged.
  assert.equal(discountHalalas(2500, "FIXED", 24), 2400);
  assert.equal(discountHalalas(2500, "PERCENT", 100), 2500);
});

test("a code refuses outside its window, when off, and when used up", () => {
  const open = { active: true, startsAt: null, endsAt: null, maxUses: null };
  assert.equal(codeRefusal(open, 999, NOW), null);
  assert.equal(codeRefusal({ ...open, active: false }, 0, NOW), "inactive");
  assert.equal(codeRefusal({ ...open, startsAt: new Date("2026-09-16T00:00:00Z") }, 0, NOW), "notStarted");
  assert.equal(codeRefusal({ ...open, endsAt: NOW }, 0, NOW), "expired");
  assert.equal(codeRefusal({ ...open, maxUses: 10 }, 9, NOW), null);
  assert.equal(codeRefusal({ ...open, maxUses: 10 }, 10, NOW), "usedUp");
});

test("only known refusals are read from the address bar", () => {
  assert.ok(isDiscountRefusal("usedUp"));
  assert.ok(!isDiscountRefusal("constructor"));
  assert.ok(!isDiscountRefusal(["usedUp"]));
});

const input = {
  code: "watani96",
  kind: "PERCENT",
  value: 20,
  maxUses: 100 as number | null,
  startsAt: null as Date | null,
  endsAt: new Date("2026-09-30T21:00:00Z") as Date | null,
};

test("the admin form stores a folded code with its limits", () => {
  const built = buildDiscountCode(input, NOW);
  assert.ok("code" in built);
  assert.equal(built.code.code, "WATANI96");
  assert.equal(built.code.maxUses, 100);
});

test("the admin form refuses what cannot work", () => {
  assert.deepEqual(buildDiscountCode({ ...input, code: "x" }, NOW), { error: "code" });
  assert.deepEqual(buildDiscountCode({ ...input, value: 101 }, NOW), { error: "value" });
  assert.deepEqual(buildDiscountCode({ ...input, value: 0 }, NOW), { error: "value" });
  assert.deepEqual(buildDiscountCode({ ...input, kind: "BOGUS" }, NOW), { error: "value" });
  assert.deepEqual(buildDiscountCode({ ...input, maxUses: 0 }, NOW), { error: "maxUses" });
  assert.deepEqual(buildDiscountCode({ ...input, maxUses: 2.5 }, NOW), { error: "maxUses" });
  assert.deepEqual(
    buildDiscountCode({ ...input, startsAt: new Date("2026-10-01T00:00:00Z") }, NOW),
    { error: "dates" },
  );
  assert.deepEqual(buildDiscountCode({ ...input, endsAt: new Date("2026-09-01T00:00:00Z") }, NOW), {
    error: "ended",
  });
  // Open on both ends and unlimited is a valid code.
  assert.ok("code" in buildDiscountCode({ ...input, maxUses: null, endsAt: null }, NOW));
  assert.ok("code" in buildDiscountCode({ ...input, kind: "FIXED", value: 150 }, NOW));
});
