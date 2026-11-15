import test from "node:test";
import assert from "node:assert/strict";
import { calculateNextRetryAt, MAX_ATTEMPTS } from "../../src/services/retryPolicy.js";
import { orderSchema } from "../../src/schemas/orderSchema.js";
import { sendOrderToExternalSystem, IntegrationError } from "../../src/services/integrationService.js";

const valid = { externalId: " UNIT ", customerName: " Example ", customerEmail: "test@example.com", amount: 12.34, currency: "PLN" };
test("retry policy schedules 30s, 120s, then stops without mutating time", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(MAX_ATTEMPTS, 3);
  assert.equal(calculateNextRetryAt(1, now).getTime() - now.getTime(), 30000);
  assert.equal(calculateNextRetryAt(2, now).getTime() - now.getTime(), 120000);
  assert.equal(calculateNextRetryAt(3, now), null);
  assert.equal(calculateNextRetryAt(4, now), null);
  assert.equal(now.toISOString(), "2026-01-01T00:00:00.000Z");
});
test("schema accepts currencies and trims identifiers/names", () => {
  for (const currency of ["PLN", "EUR", "USD"]) {
    const parsed = orderSchema.parse({ ...valid, currency });
    assert.equal(parsed.externalId, "UNIT");
    assert.equal(parsed.customerName, "Example");
  }
});
for (const [field, values] of Object.entries({
  externalId: ["", " "], customerName: [""], customerEmail: ["invalid"],
  amount: [0, -1, "12.34", Infinity, NaN], currency: ["GBP"],
})) {
  test("schema rejects invalid " + field, () => {
    for (const value of values) assert.equal(orderSchema.safeParse({ ...valid, [field]: value }).success, false);
  });
}
test("simulator classifies permanent/temporary failures and accepts normal orders", async () => {
  assert.deepEqual(await sendOrderToExternalSystem({ externalId: "unit-ok" }), {
    accepted: true, externalReference: "EXT-unit-ok",
  });
  await assert.rejects(sendOrderToExternalSystem({ externalId: "unit-FAIL" }),
    e => e instanceof IntegrationError && e.retryable === false);
  await assert.rejects(sendOrderToExternalSystem({ externalId: "unit-RETRY" }),
    e => e instanceof IntegrationError && e.retryable === true);
  assert.equal((await sendOrderToExternalSystem({ externalId: "unit-RETRY" })).accepted, true);
});
