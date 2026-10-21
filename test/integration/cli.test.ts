import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { readYamlFile } from "../../src/config.ts";

const PILOT = "experiments/email-pilot.yaml";

// Run the real CLI as a separate process, like a user would.
function bench(...args: string[]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    encoding: "utf8",
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("help prints usage and exits 0", () => {
  const r = bench("help");
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Usage:/);
});

test("no command is a usage error (2)", () => {
  assert.equal(bench().code, 2);
});

test("unknown command is a usage error (2)", () => {
  const r = bench("nope");
  assert.equal(r.code, 2);
  assert.match(r.stderr, /unknown command 'nope'/);
});

test("plan without a file is a usage error (2)", () => {
  assert.equal(bench("plan").code, 2);
});

test("plan lists the 6 pilot runs on stdout", () => {
  const r = bench("plan", PILOT);
  assert.equal(r.code, 0);
  const ids = r.stdout.trim().split("\n");
  assert.equal(ids.length, 6);
  assert.equal(ids[0], "email-pilot/opencode/opencode-big-pickle/junior.p1/r1");
  assert.match(r.stderr, /6 runs/);
});

test("plan fails (1) on a missing experiment file", () => {
  const r = bench("plan", "nope.yaml");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /cannot read nope\.yaml/);
});

test("plan fails (1) when a prompt file is missing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cli-"));
  const data: any = await readYamlFile(PILOT);
  data.prompts.dir = join(dir, "no-prompts");
  const path = join(dir, "exp.yaml");
  await writeFile(path, stringify(data));

  const r = bench("plan", path);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /cannot read/);
  assert.equal(r.stdout, "", "no run should be listed");
});
