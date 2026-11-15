import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

// Refuse direct execution against a developer's application database.
const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
assert.match(process.env.LAB_TEST_DATABASE ?? "", /^lab_test_[a-f0-9]{32}$/);
assert.equal(url.pathname, "/" + process.env.LAB_TEST_DATABASE);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
const { default: app } = await import("../../src/app.js");
const { default: prisma } = await import("../../src/lib/prisma.js");
const { runRetryCycle } = await import("../../src/workers/retryWorker.js");
let server, base;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  await prisma.$disconnect();
});
beforeEach(async () => {
  await prisma.integrationAttempt.deleteMany();
  await prisma.order.deleteMany();
});
const data = (externalId = "order") => ({
  externalId, customerName: "Test Company", customerEmail: "test@example.com", amount: 12.34, currency: "PLN",
});
async function request(path, body) {
  const response = await fetch(base + path, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
async function create(id) {
  const result = await request("/api/orders", data(id));
  assert.equal(result.status, 201);
  return result.body.order;
}
const processPath = id => "/api/orders/" + id + "/process";

test("health and persisted order round-trip", async () => {
  assert.deepEqual(await request("/health"), { status: 200, body: { status: "ok" } });
  const order = await create("round-trip");
  assert.equal(order.amountCents, 1234);
  assert.equal(order.status, "RECEIVED");
  assert.equal((await request("/api/orders/" + order.id)).body.order.id, order.id);
  assert.equal((await request("/api/orders")).body.orders.length, 1);
});
test("concurrent duplicate creation persists one order; conflicting payload is rejected", async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => request("/api/orders", data("duplicate"))));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 200).length, 9);
  assert.equal(new Set(results.map(r => r.body.order.id)).size, 1);
  assert.equal(await prisma.order.count(), 1);
  assert.equal((await request("/api/orders", { ...data("duplicate"), amount: 20 })).status, 409);
  assert.equal((await prisma.order.findFirst()).amountCents, 1234);
});
test("invalid payloads and IDs return 400; absent records return 404", async () => {
  assert.equal((await request("/api/orders", {})).status, 400);
  assert.equal((await request("/api/orders", { ...data(), amount: 0 })).status, 400);
  for (const id of ["abc", "0", "-1"]) {
    assert.equal((await request("/api/orders/" + id)).status, 400);
    assert.equal((await request(processPath(id), {})).status, 400);
  }
  assert.equal((await request("/api/orders/2147483647")).status, 404);
  assert.equal((await request(processPath(2147483647), {})).status, 404);
  assert.equal(await prisma.order.count(), 0);
});
test("concurrent processing produces one successful persisted attempt", async () => {
  const order = await create("concurrent");
  const results = await Promise.all(Array.from({ length: 10 },
    () => request(processPath(order.id), {})));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 9);
  const attempts = await prisma.integrationAttempt.findMany({ where: { orderId: order.id } });
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, "SUCCEEDED");
  assert.equal(attempts[0].externalReference, "EXT-concurrent");
  assert.ok(attempts[0].finishedAt);
  assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, "COMPLETED");
});
test("permanent failure records error and is not scheduled by worker", async () => {
  const order = await create("permanent-FAIL");
  const result = await request(processPath(order.id), {});
  assert.equal(result.status, 502);
  assert.equal(result.body.order.status, "FAILED");
  assert.equal(result.body.order.nextRetryAt, null);
  await runRetryCycle();
  const attempts = await prisma.integrationAttempt.findMany();
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, "FAILED");
  assert.equal(attempts[0].errorMessage, "External system rejected order");
});
test("worker skips future retries and processes due retries once", async () => {
  const order = await create("temporary-RETRY");
  const started = Date.now();
  const result = await request(processPath(order.id), {});
  assert.equal(result.status, 502);
  assert.ok(Date.parse(result.body.order.nextRetryAt) >= started + 30000);
  await runRetryCycle();
  assert.equal(await prisma.integrationAttempt.count(), 1);
  await prisma.order.update({ where: { id: order.id }, data: { nextRetryAt: new Date(0) } });
  await Promise.all([runRetryCycle(), runRetryCycle()]);
  const stored = await prisma.order.findUnique({ where: { id: order.id } });
  assert.equal(stored.status, "COMPLETED");
  assert.equal(stored.nextRetryAt, null);
  const attempts = await prisma.integrationAttempt.findMany({ orderBy: { id: "asc" } });
  assert.deepEqual(attempts.map(a => a.status), ["FAILED", "SUCCEEDED"]);
});
test("database error during claim rolls back both status and attempt", async () => {
  const order = await create("rollback");
  await prisma.$executeRawUnsafe("CREATE FUNCTION reject_test_attempt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected test failure'; END $$");
  await prisma.$executeRawUnsafe("CREATE TRIGGER reject_test_attempt BEFORE INSERT ON integration_attempts FOR EACH ROW EXECUTE FUNCTION reject_test_attempt()");
  try {
    const response = await fetch(base + processPath(order.id), { method: "POST" });
    assert.equal(response.status, 500);
    await response.text();
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, "RECEIVED");
    assert.equal(await prisma.integrationAttempt.count(), 0);
  } finally {
    await prisma.$executeRawUnsafe("DROP TRIGGER reject_test_attempt ON integration_attempts");
    await prisma.$executeRawUnsafe("DROP FUNCTION reject_test_attempt()");
  }
  assert.equal((await request(processPath(order.id), {})).status, 200);
});
