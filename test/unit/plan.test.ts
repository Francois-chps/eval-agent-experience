import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigError, loadExperiment } from "../../src/config.ts";
import { buildPlan, modelSlug } from "../../src/plan.ts";

const pilot = await loadExperiment("experiments/email-pilot.yaml");

test("the pilot expands to 6 runs with stable ids", () => {
  assert.deepEqual(
    buildPlan(pilot).map((run) => run.id),
    [
      "email-pilot/opencode/opencode-big-pickle/junior.p1/r1",
      "email-pilot/opencode/opencode-big-pickle/junior.p2/r1",
      "email-pilot/opencode/opencode-big-pickle/senior.p1/r1",
      "email-pilot/opencode/opencode-big-pickle/senior.p2/r1",
      "email-pilot/opencode/opencode-big-pickle/cto.p1/r1",
      "email-pilot/opencode/opencode-big-pickle/cto.p2/r1",
    ],
  );
});

test("the same config always gives the same plan", () => {
  assert.deepEqual(buildPlan(pilot), buildPlan(pilot));
});

test("each run points to its prompt file", () => {
  const run = buildPlan(pilot).find((r) => r.persona === "cto" && r.wording === "p1");
  assert.equal(run?.promptPath, "prompts/email/cto.p1.md");
  assert.equal(run?.model, "opencode/big-pickle");
});

test("repetitions multiply the runs and keep ids unique", () => {
  const runs = buildPlan({ ...pilot, repetitions: 3 });
  assert.equal(runs.length, 18);
  assert.equal(new Set(runs.map((r) => r.id)).size, 18);
  assert.ok(runs.some((r) => r.id.endsWith("/cto.p1/r3")));
});

test("repetitions are interleaved: a full round before the next one", () => {
  const runs = buildPlan({ ...pilot, repetitions: 3 });
  assert.deepEqual(
    runs.map((r) => r.repetition),
    [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3],
  );
});

test("growing the config keeps the ids of existing runs", () => {
  const before = buildPlan(pilot).map((r) => r.id);
  const more = buildPlan({
    ...pilot,
    repetitions: 2,
    prompts: { ...pilot.prompts, personas: [...pilot.prompts.personas, "staff"] },
  }).map((r) => r.id);
  for (const id of before) {
    assert.ok(more.includes(id), `${id} should still be planned`);
  }
});

test("model names become folder-safe slugs", () => {
  assert.equal(modelSlug("opencode/big-pickle"), "opencode-big-pickle");
  assert.equal(modelSlug("Org/Model 2.5"), "org-model-2.5");
});

test("rejects two models that would share a run id", () => {
  const agent = { ...pilot.agents[0]!, models: ["a/b", "a-b"] };
  assert.throws(() => buildPlan({ ...pilot, agents: [agent] }), ConfigError);
});

const withConditions = {
  ...pilot,
  conditions: [
    { id: "baseline" },
    { id: "mention", overlay: "fixtures/incumbent-sendgrid/mention" },
  ],
};

test("without conditions, every run is an implicit baseline without overlay", () => {
  for (const run of buildPlan(pilot)) {
    assert.equal(run.condition, "baseline");
    assert.equal(run.overlay, null);
  }
});

test("declared conditions become a run id segment", () => {
  const ids = buildPlan(withConditions).map((r) => r.id);
  assert.equal(ids.length, 12);
  assert.ok(ids.includes("email-pilot/opencode/opencode-big-pickle/baseline/cto.p1/r1"));
  assert.ok(ids.includes("email-pilot/opencode/opencode-big-pickle/mention/cto.p1/r1"));
});

test("each run carries the overlay of its condition", () => {
  const runs = buildPlan(withConditions);
  assert.equal(runs.find((r) => r.condition === "mention")?.overlay, "fixtures/incumbent-sendgrid/mention");
  assert.equal(runs.find((r) => r.condition === "baseline")?.overlay, null);
});

test("conditions are expanded inside each repetition", () => {
  const runs = buildPlan({ ...withConditions, repetitions: 2 });
  const round = (r: number) => [
    ...Array<string>(6).fill(`${r}:baseline`),
    ...Array<string>(6).fill(`${r}:mention`),
  ];
  assert.deepEqual(
    runs.map((r) => `${r.repetition}:${r.condition}`),
    [...round(1), ...round(2)],
  );
});
