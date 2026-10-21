import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function bench(...args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    encoding: "utf8",
  });
}

test("run without an experiment file is a usage error", () => {
  const result = bench("run");
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes("run needs an experiment file"), result.stderr);
});

test("run with a missing experiment file fails before any check", () => {
  const result = bench("run", "experiments/no-such-file.yaml");
  assert.equal(result.status, 1);
  assert.equal(result.stderr.includes("FAIL"), false, result.stderr);
});
