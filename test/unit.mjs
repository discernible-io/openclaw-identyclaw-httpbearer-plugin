#!/usr/bin/env node
/**
 * Unit tests for @identyclaw/openclaw-identyclaw-httpbearer-plugin (no OpenClaw gateway required).
 *
 * Run: npm test
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function load(modulePath) {
  return import(pathToFileURL(modulePath).href);
}

const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiJndWVzdF8wMSIsImV4cCI6OTk5OTk5OTk5OX0." +
  "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV";

let tmpDir = "";

process.stdout.write("httpbearer plugin unit tests\n\n");

try {
  tmpDir = await mkdtemp(join(tmpdir(), "httpbearer-test-"));

  const jwt = await load(join(pluginRoot, "lib", "jwt.mjs"));
  assert.equal(jwt.isLikelyJwt(SAMPLE_JWT), true);
  assert.equal(jwt.isLikelyJwt("eyJhbG…bXDA"), false);
  assert.equal(jwt.isLikelyJwt("short"), false);
  assert.ok(jwt.decodeJwtExpMs(SAMPLE_JWT) > Date.now());

  const redact = await load(join(pluginRoot, "lib", "redact.mjs"));
  const body = { jwt_token: SAMPLE_JWT, agent: { id: "abc" } };
  const redacted = redact.redactSecrets(body, new Map([[SAMPLE_JWT, "[stored]"]]));
  assert.equal(redacted.jwt_token, "[stored]");
  assert.equal(redacted.agent.id, "abc");

  const storeMod = await load(join(pluginRoot, "lib", "store.mjs"));
  const store = storeMod.createBearerStore({ stateDir: tmpDir });
  await store.writeSession("lastcradle", {
    token: SAMPLE_JWT,
    baseUrl: "https://api.lastcradle.io",
    expiresAt: jwt.decodeJwtExpMs(SAMPLE_JWT),
    metadata: { agentId: "01TEST" },
    updatedAt: Date.now(),
  });

  const onDisk = JSON.parse(
    await readFile(join(tmpDir, "secrets", "bearer", "lastcradle.json"), "utf8"),
  );
  assert.equal(onDisk.token, SAMPLE_JWT);
  assert.equal(onDisk.metadata.agentId, "01TEST");

  const listed = await store.listSessions();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].namespace, "lastcradle");
  assert.equal(listed[0].tokenLen, SAMPLE_JWT.length);
  assert.equal("token" in listed[0], false);

  assert.equal(await store.deleteSession("lastcradle"), true);
  assert.equal(await store.deleteSession("missing"), false);

  process.stdout.write("  jwt + redact + store: ok\n");
  process.stdout.write("\n--- httpbearer plugin unit: passed ---\n");
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
