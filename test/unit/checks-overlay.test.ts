import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preflight } from "../../src/checks.ts";
import { loadExperiment } from "../../src/config.ts";
import type { Run } from "../../src/exec.ts";

const pilot = await loadExperiment("experiments/email-pilot.yaml");

// Every command "succeeds": only the overlay checks matter here.
const ok: Run = async () => ({ code: 0, stdout: "", stderr: "" });

test("preflight checks each overlay before any run", async () => {
  const overlay = await mkdtemp(join(tmpdir(), "overlay-"));
  await writeFile(join(overlay, "README.md"), "x");
  const conditions = [
    { id: "baseline" },
    { id: "mention", overlay },
    { id: "env", overlay: join(tmpdir(), "no-such-overlay") },
  ];
  const results = await preflight({ ...pilot, conditions }, ok);
  const overlays = results.filter((r) => r.name.startsWith("overlay "));
  assert.deepEqual(
    overlays.map((r) => [r.name, r.ok]),
    [["overlay mention", true], ["overlay env", false]],
  );
  assert.ok(overlays[0]?.detail.includes("README.md"), overlays[0]?.detail);
  assert.ok(overlays[1]?.detail.includes("does not exist"), overlays[1]?.detail);
});

test("an experiment without conditions has no overlay check", async () => {
  const results = await preflight(pilot, ok);
  assert.equal(results.some((r) => r.name.startsWith("overlay ")), false);
});
