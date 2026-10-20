import { test } from "node:test";
import assert from "node:assert/strict";
import { runCommand } from "../../src/exec.ts";

test("captures stdout, stderr and the exit code", async () => {
  const r = await runCommand(process.execPath, [
    "-e",
    "process.stdout.write('out'); process.stderr.write('err'); process.exit(3)",
  ]);
  assert.equal(r.code, 3);
  assert.equal(r.stdout, "out");
  assert.equal(r.stderr, "err");
});

test("a command that cannot start gives code null instead of throwing", async () => {
  const r = await runCommand("definitely-not-a-command-xyz", []);
  assert.equal(r.code, null);
  assert.match(r.stderr, /ENOENT/);
});
