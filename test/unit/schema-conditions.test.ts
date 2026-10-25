import { test } from "node:test";
import assert from "node:assert/strict";
import { loadExperiment } from "../../src/config.ts";
import { ExperimentSchema } from "../../src/schema.ts";

const pilot = await loadExperiment("experiments/email-pilot.yaml");

function parse(conditions: unknown) {
  return ExperimentSchema.safeParse({ ...pilot, conditions });
}

test("conditions are optional", () => {
  assert.equal(pilot.conditions, undefined);
  assert.equal(ExperimentSchema.safeParse(pilot).success, true);
});

test("accepts conditions with and without an overlay", () => {
  const conditions = [
    { id: "baseline" },
    { id: "mention", overlay: "fixtures/incumbent-sendgrid/mention" },
  ];
  const result = parse(conditions);
  assert.equal(result.success, true);
  assert.deepEqual(result.data?.conditions, conditions);
});

test("duplicate condition ids are rejected with a clear message", () => {
  const result = parse([{ id: "env" }, { id: "env" }]);
  assert.equal(result.success, false);
  assert.ok(result.error?.issues.some((i) => i.message === "condition ids must be unique"));
});

const invalid: [string, unknown][] = [
  ["an empty list", []],
  ["an id that is not a slug", [{ id: "Mention" }]],
  ["an id with a slash", [{ id: "a/b" }]],
  ["an empty overlay path", [{ id: "env", overlay: "" }]],
  ["an unknown key (typo)", [{ id: "env", overlays: "fixtures/x" }]],
  ["a condition without id", [{ overlay: "fixtures/x" }]],
];

for (const [what, conditions] of invalid) {
  test(`rejects conditions with ${what}`, () => {
    assert.equal(parse(conditions).success, false);
  });
}
