import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
// Never use the application's DATABASE_URL or load .env for test selection.
const adminUrl = new URL(process.env.TEST_DATABASE_URL ??
  "postgresql://lab:lab@127.0.0.1:55432/postgres");
if (!["postgres:", "postgresql:"].includes(adminUrl.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(adminUrl.hostname) ||
    adminUrl.search || adminUrl.hash) {
  throw new Error("TEST_DATABASE_URL must target local PostgreSQL without query parameters.");
}
adminUrl.pathname = "/postgres";
const name = "lab_test_" + randomUUID().replaceAll("-", "");
const testUrl = new URL(adminUrl);
testUrl.pathname = "/" + name;
const childEnv = {
  ...process.env, DATABASE_URL: testUrl.href, SHADOW_DATABASE_URL: "",
  NODE_ENV: "test", LAB_TEST_DATABASE: name,
};
const admin = new pg.Client({ connectionString: adminUrl.href, connectionTimeoutMillis: 5000 });
const run = (args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { stdio: "inherit", env: childEnv });
  child.on("error", reject);
  child.on("exit", (code, signal) => code === 0
    ? resolve() : reject(new Error("Test command failed (exit=" + code + ", signal=" + signal + ")")));
});
let created = false;
try {
  await admin.connect();
  await admin.query('CREATE DATABASE "' + name + '"');
  created = true;
  await run(["node_modules/prisma/build/index.js", "generate", "--config", "prisma7.config.ts"]);
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "prisma7.config.ts"]);
  await run(["--test", "--test-timeout=30000", "tests/integration/orders.test.js"]);
} finally {
  try {
    if (created) await admin.query('DROP DATABASE "' + name + '" WITH (FORCE)');
  } finally {
    await admin.end();
  }
}
