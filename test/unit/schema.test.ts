import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigError, loadExperiment, readYamlFile } from "../../src/config.ts";
import { ExperimentSchema } from "../../src/schema.ts";

const PILOT = "experiments/email-pilot.yaml";

// Load the real pilot config, change one thing, and tell if the schema accepts it.
async function acceptsAfter(change: (e: any) => void): Promise<boolean> {
  const data: any = await readYamlFile(PILOT);
  change(data);
  return ExperimentSchema.safeParse(data).success;
}

test("the pilot config is valid", async () => {
  const e = await loadExperiment(PILOT);
  assert.equal(e.id, "email-pilot");
  assert.equal(e.repetitions, 1);
  assert.equal(e.agents.length, 1);
});

test("rejects an unknown key (typo)", async () => {
  const ok = await acceptsAfter((e) => {
    e.repetition = e.repetitions;
    delete e.repetitions;
  });
  assert.equal(ok, false);
});

test("rejects a timeout that is not a number", async () => {
  assert.equal(await acceptsAfter((e) => { e.timeout_s = "20min"; }), false);
});

test("rejects zero repetitions", async () => {
  assert.equal(await acceptsAfter((e) => { e.repetitions = 0; }), false);
});

test("rejects a version read as a number by YAML", async () => {
  assert.equal(await acceptsAfter((e) => { e.agents[0].version = 1.2; }), false);
});

test("rejects a duplicated persona", async () => {
  assert.equal(await acceptsAfter((e) => { e.prompts.personas = ["junior", "junior", "cto"]; }), false);
});

test("rejects an unknown turn type", async () => {
  assert.equal(await acceptsAfter((e) => { e.protocol.turns[1].type = "mesage"; }), false);
});

test("rejects a protocol that does not start with the prompt", async () => {
  assert.equal(await acceptsAfter((e) => { e.protocol.turns.reverse(); }), false);
});

test("rejects duplicate YAML keys", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exp-"));
  const path = join(dir, "dup.yaml");
  await writeFile(path, "a: 1\na: 2\n");
  await assert.rejects(readYamlFile(path), ConfigError);
});

test("loadExperiment turns schema errors into ConfigError", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exp-"));
  const path = join(dir, "bad.yaml");
  await writeFile(path, "id: email-pilot\n");
  await assert.rejects(loadExperiment(path), ConfigError);
});
