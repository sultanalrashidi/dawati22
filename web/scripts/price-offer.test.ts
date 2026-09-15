import assert from "node:assert/strict";
import test from "node:test";
import { buildPriceOffer, offerPhase, offerUnitPrice, parsePriceOffer, type PriceOffer } from "../src/lib/orders/offer";

const REGULAR = { withQr: 2.75, noQr: 2 };
const NOW = new Date("2026-09-15T12:00:00Z");

const nationalDay: PriceOffer = {
  nameAr: "عرض اليوم الوطني",
  nameEn: "",
  withQr: 2,
  noQr: 1,
  startsAt: "2026-09-15T00:00:00.000Z",
  endsAt: "2026-09-24T21:00:00.000Z",
  enabled: true,
};

test("the owner's National Day prices are what a running offer charges", () => {
  assert.equal(offerUnitPrice(nationalDay, "WITH_QR", REGULAR.withQr, NOW), 2);
  assert.equal(offerUnitPrice(nationalDay, "NO_QR", REGULAR.noQr, NOW), 1);
});

test("outside its dates, or switched off, the regular rate applies", () => {
  const before = new Date("2026-09-14T23:59:59Z");
  const atEnd = new Date(nationalDay.endsAt);
  assert.equal(offerPhase(nationalDay, before), "scheduled");
  assert.equal(offerUnitPrice(nationalDay, "WITH_QR", 2.75, before), 2.75);
  // The end instant itself is already over.
  assert.equal(offerPhase(nationalDay, atEnd), "ended");
  assert.equal(offerUnitPrice(nationalDay, "NO_QR", 2, atEnd), 2);
  const stopped = { ...nationalDay, enabled: false };
  assert.equal(offerPhase(stopped, NOW), "stopped");
  assert.equal(offerUnitPrice(stopped, "WITH_QR", 2.75, NOW), 2.75);
  assert.equal(offerPhase(null, NOW), "none");
});

test("an offer never raises a price, even if the regular rate drops below it later", () => {
  assert.equal(offerUnitPrice(nationalDay, "WITH_QR", 1.5, NOW), 1.5);
});

test("the stored JSON reads back, and anything malformed reads as no offer", () => {
  assert.deepEqual(parsePriceOffer(JSON.stringify(nationalDay)), nationalDay);
  assert.equal(parsePriceOffer(null), null);
  assert.equal(parsePriceOffer("not json"), null);
  assert.equal(parsePriceOffer(JSON.stringify({ ...nationalDay, withQr: "2" })), null);
  assert.equal(parsePriceOffer(JSON.stringify({ ...nationalDay, endsAt: "someday" })), null);
});

const input = {
  nameAr: " عرض اليوم الوطني ",
  nameEn: "",
  withQr: 2,
  noQr: 1,
  startsAt: new Date("2026-09-15T09:00:00Z"),
  endsAt: new Date("2026-09-24T21:00:00Z"),
};

test("a valid form becomes a switched-on offer with a trimmed name", () => {
  const built = buildPriceOffer(input, REGULAR, NOW);
  assert.ok("offer" in built);
  assert.equal(built.offer.nameAr, "عرض اليوم الوطني");
  assert.equal(built.offer.enabled, true);
  assert.equal(built.offer.endsAt, "2026-09-24T21:00:00.000Z");
});

test("the form refuses what would not be an offer", () => {
  assert.deepEqual(buildPriceOffer({ ...input, nameAr: "  " }, REGULAR, NOW), { error: "name" });
  assert.deepEqual(buildPriceOffer({ ...input, noQr: 0 }, REGULAR, NOW), { error: "price" });
  assert.deepEqual(buildPriceOffer({ ...input, noQr: Number.NaN }, REGULAR, NOW), { error: "price" });
  // Above the regular rate on either tier.
  assert.deepEqual(buildPriceOffer({ ...input, withQr: 3 }, REGULAR, NOW), { error: "notLower" });
  // Equal on both tiers: nothing is on offer.
  assert.deepEqual(buildPriceOffer({ ...input, withQr: 2.75, noQr: 2 }, REGULAR, NOW), { error: "notLower" });
  assert.deepEqual(buildPriceOffer({ ...input, startsAt: null }, REGULAR, NOW), { error: "dates" });
  assert.deepEqual(buildPriceOffer({ ...input, endsAt: input.startsAt }, REGULAR, NOW), { error: "dates" });
  assert.deepEqual(
    buildPriceOffer(
      { ...input, startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2026-09-10T00:00:00Z") },
      REGULAR,
      NOW,
    ),
    { error: "ended" },
  );
});

test("an offer on one tier only is allowed", () => {
  assert.ok("offer" in buildPriceOffer({ ...input, noQr: 2 }, REGULAR, NOW));
});
