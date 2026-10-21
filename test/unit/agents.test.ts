import { test } from "node:test";
import assert from "node:assert/strict";
import { findAdapter } from "../../src/agents/index.ts";

test("the opencode adapter is registered under its id", () => {
  assert.equal(findAdapter("opencode")?.id, "opencode");
});

test("an unknown agent has no adapter", () => {
  assert.equal(findAdapter("no-such-agent"), undefined);
});

test("inherited object keys are not adapters", () => {
  assert.equal(findAdapter("constructor"), undefined);
});
