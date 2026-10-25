import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readMeta, writeMeta, type Meta } from "../../src/meta.ts";

const META: Meta = {
  run_id: "email-pilot/opencode/some-model/cto.p1/r1",
  experiment: "email-pilot",
  prompt_id: "email.cto.p1",
  persona: "cto",
  wording: "p1",
  repetition: 1,
  agent: "opencode",
  agent_version: "1.19.3",
  model: "opencode/some-model",
  image: "agent-bench:0.1",
  repo_hash: "7e73ee6a7ade",
  workspace_branch: "master",
  session_id: "ses_abc123",
  started_at: "2026-10-21T12:00:00.000Z",
  timeout_s: 1800,
  turns: [
    { exit: 0, seconds: 42.517, timed_out: false, skipped: false, error: null },
    { exit: null, seconds: 1800.2, timed_out: true, skipped: false, error: null },
  ],
  tokens: 123456,
  cost: 0,
  tool_calls: 17,
  agent_files_written: 0,
};

// Path of meta.json in a temporary directory removed after the test.
async function metaPath(t: TestContext): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "meta-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return join(dir, "meta.json");
}

test("a written meta reads back unchanged", async (t) => {
  const path = await metaPath(t);
  await writeMeta(path, META);
  assert.deepEqual(await readMeta(path), { status: "ok", meta: META });
});

test("a missing meta.json means the run is not finished", async (t) => {
  assert.deepEqual(await readMeta(await metaPath(t)), { status: "missing" });
});

test("a truncated meta.json is invalid, not missing", async (t) => {
  const path = await metaPath(t);
  await writeFile(path, '{"run_id": "email-pi');
  const read = await readMeta(path);
  assert.equal(read.status, "invalid");
});

test("a meta.json without tokens is invalid and says why", async (t) => {
  const path = await metaPath(t);
  const { tokens, ...withoutTokens } = META;
  await writeFile(path, JSON.stringify(withoutTokens));
  const read = await readMeta(path);
  assert.equal(read.status, "invalid");
  assert.ok(read.status === "invalid" && read.reason.includes("tokens"));
});

test("unknown fields are rejected", async (t) => {
  const path = await metaPath(t);
  await writeFile(path, JSON.stringify({ ...META, extra: 1 }));
  assert.equal((await readMeta(path)).status, "invalid");
});

test("an invalid meta is never written", async (t) => {
  const path = await metaPath(t);
  await assert.rejects(writeMeta(path, { ...META, tokens: -1 }));
  assert.deepEqual(await readMeta(path), { status: "missing" });
});

test("condition and overlay hash are recorded, and optional for older runs", async (t) => {
  // META has neither field, like the email-full runs (first test: still valid).
  const path = await metaPath(t);
  const withCondition: Meta = { ...META, condition: "mention", overlay_hash: "0123456789ab" };
  await writeMeta(path, withCondition);
  assert.deepEqual(await readMeta(path), { status: "ok", meta: withCondition });
  await assert.rejects(writeMeta(path, { ...META, overlay_hash: "not-a-hash" }));
});
