import { test } from "node:test";
import assert from "node:assert/strict";
import { preflight } from "../../src/checks.ts";
import { loadExperiment } from "../../src/config.ts";
import type { CommandResult, Run } from "../../src/exec.ts";

const pilot = await loadExperiment("experiments/email-pilot.yaml");

const HASH = "scripts/repo-hash.sh repos/nextjs-saas-startup";
const NEUTRAL = "scripts/check-neutrality.sh repos/nextjs-saas-startup";
const INSPECT = "docker image inspect --format {{.Id}} agent-bench:0.1";
const VERSION = "docker run --rm agent-bench:0.1 opencode --version";

const HAPPY: Record<string, Partial<CommandResult>> = {
  [HASH]: { stdout: "7e73ee6a7ade\n" },
  [NEUTRAL]: { stdout: "neutral\n" },
  [INSPECT]: { stdout: "sha256:abc\n" },
  [VERSION]: { stdout: "1.19.3\n" },
};

// Fake runner: answers from a table and records every command it got.
function fake(overrides: Record<string, Partial<CommandResult>> = {}) {
  const replies = { ...HAPPY, ...overrides };
  const calls: string[] = [];
  const run: Run = async (command, args) => {
    const key = [command, ...args].join(" ");
    calls.push(key);
    const reply = replies[key];
    if (reply === undefined) return { code: 127, stdout: "", stderr: `unexpected: ${key}` };
    return { code: 0, stdout: "", stderr: "", ...reply };
  };
  return { run, calls };
}

function byName(results: { name: string; ok: boolean; detail: string }[], name: string) {
  const found = results.find((r) => r.name === name);
  assert.ok(found, `missing check ${name}`);
  return found;
}

test("all checks pass when conditions match the config", async () => {
  const { run, calls } = fake();
  const results = await preflight(pilot, run);
  assert.deepEqual(results.map((r) => [r.name, r.ok]), [
    ["repo hash", true],
    ["neutrality", true],
    ["opencode image", true],
    ["opencode version", true],
  ]);
  assert.deepEqual(calls, [HASH, NEUTRAL, INSPECT, VERSION]);
});

test("a different repo hash fails and says what was expected", async () => {
  const { run } = fake({ [HASH]: { stdout: "000000000000\n" } });
  const check = byName(await preflight(pilot, run), "repo hash");
  assert.equal(check.ok, false);
  assert.match(check.detail, /expects 7e73ee6a7ade/);
});

test("a non-neutral repo fails with the script output", async () => {
  const { run } = fake({ [NEUTRAL]: { code: 1, stdout: "vendor found: resend\n" } });
  const check = byName(await preflight(pilot, run), "neutrality");
  assert.equal(check.ok, false);
  assert.match(check.detail, /resend/);
});

test("a missing image fails and its version is not asked", async () => {
  const { run, calls } = fake({ [INSPECT]: { code: 1, stderr: "No such image\n" } });
  const results = await preflight(pilot, run);
  assert.equal(byName(results, "opencode image").ok, false);
  assert.ok(!calls.includes(VERSION), "docker run would try to pull the image");
});

test("a different agent version fails", async () => {
  const { run } = fake({ [VERSION]: { stdout: "1.20.0\n" } });
  const check = byName(await preflight(pilot, run), "opencode version");
  assert.equal(check.ok, false);
  assert.match(check.detail, /has 1\.20\.0, experiment expects 1\.19\.3/);
});

test("the version is the last line of the output", async () => {
  const { run } = fake({ [VERSION]: { stdout: "some warning\n1.19.3\n" } });
  assert.equal(byName(await preflight(pilot, run), "opencode version").ok, true);
});

test("Docker not available is reported, not thrown", async () => {
  const down = { code: null, stderr: "spawn docker ENOENT" };
  const { run } = fake({ [INSPECT]: down });
  const check = byName(await preflight(pilot, run), "opencode image");
  assert.equal(check.ok, false);
  assert.match(check.detail, /ENOENT/);
});

test("all problems are reported at once", async () => {
  const { run } = fake({
    [HASH]: { stdout: "000000000000\n" },
    [VERSION]: { stdout: "1.20.0\n" },
  });
  const failed = (await preflight(pilot, run)).filter((r) => !r.ok).map((r) => r.name);
  assert.deepEqual(failed, ["repo hash", "opencode version"]);
});
