import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LADDER = "  - id: baseline\n  - id: mention\n    overlay: OVERLAY\n";
const MISSING = "  - id: baseline\n  - id: env\n    overlay: OVERLAY/missing\n";

// Runs `bench plan` on the pilot config with these conditions appended;
// OVERLAY is replaced by a temporary overlay holding two files.
async function planWith(t: TestContext, conditions: string) {
  const tmp = await mkdtemp(join(tmpdir(), "plan-"));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const overlay = join(tmp, "overlay");
  await mkdir(overlay);
  await writeFile(join(overlay, "README.md"), "# Tablo\n");
  await writeFile(join(overlay, ".env.example"), "KEY=\n");
  const config = join(tmp, "experiment.yaml");
  const pilot = await readFile("experiments/email-pilot.yaml", "utf8");
  await writeFile(config, `${pilot}\nconditions:\n${conditions.replaceAll("OVERLAY", overlay)}`);
  return spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", "plan", config], { encoding: "utf8" });
}

test("plan lists runs per condition and the files of each overlay", async (t) => {
  const result = await planWith(t, LADDER);
  assert.equal(result.status, 0, result.stderr);
  const ids = result.stdout.trim().split("\n");
  assert.equal(ids.length, 12);
  assert.ok(ids.includes("email-pilot/opencode/opencode-big-pickle/mention/cto.p1/r1"));
  assert.ok(result.stderr.includes("condition baseline: repo as is"), result.stderr);
  assert.ok(result.stderr.includes("condition mention: "), result.stderr);
  assert.ok(result.stderr.includes(": .env.example, README.md"), result.stderr);
});

test("plan fails on a missing overlay before listing any run", async (t) => {
  const result = await planWith(t, MISSING);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.ok(result.stderr.includes("does not exist"), result.stderr);
});
