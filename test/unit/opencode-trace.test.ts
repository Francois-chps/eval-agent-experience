import { test } from "node:test";
import assert from "node:assert/strict";
import { opencode } from "../../src/agents/opencode.ts";

// One JSON object per line, like `opencode run --format json`.
function jsonl(...events: unknown[]): string {
  return events.map((event) => JSON.stringify(event)).join("\n") + "\n";
}

const SESSION = "ses_abc123";
const STEP_START = { type: "step_start", sessionID: SESSION, part: {} };

test("the session id comes from the first event that has one", () => {
  const turn = jsonl({ type: "log" }, STEP_START, { type: "text", sessionID: "ses_other" });
  assert.equal(opencode.sessionId(turn), SESSION);
});

test("a turn without any session id has none", () => {
  assert.equal(opencode.sessionId(""), undefined);
  assert.equal(opencode.sessionId(jsonl({ type: "log" })), undefined);
});

test("invalid lines are skipped instead of failing the whole turn", () => {
  const turn = "not json at all\n" + jsonl(STEP_START) + '{"type":"step_fin';
  assert.equal(opencode.sessionId(turn), SESSION);
});

test("an empty or non-string session id is ignored", () => {
  const turn = jsonl({ sessionID: 42 }, { sessionID: "" }, STEP_START);
  assert.equal(opencode.sessionId(turn), SESSION);
});

const TOOL_USE = { type: "tool_use", sessionID: SESSION, part: { tool: "read" } };

function stepFinish(total: number, cost: number) {
  return { type: "step_finish", sessionID: SESSION, part: { tokens: { total }, cost } };
}

test("metrics add up every step and count tool calls", () => {
  const trace = jsonl(
    STEP_START,
    TOOL_USE,
    stepFinish(1000, 0.25),
    STEP_START,
    TOOL_USE,
    TOOL_USE,
    stepFinish(500, 0.5),
  );
  assert.deepEqual(opencode.metrics(trace), { tokens: 1500, cost: 0.75, tool_calls: 3 });
});

test("an empty trace has zero metrics", () => {
  assert.deepEqual(opencode.metrics(""), { tokens: 0, cost: 0, tool_calls: 0 });
});

test("a step without tokens or cost counts as zero", () => {
  const trace = jsonl({ type: "step_finish", part: {} }, { type: "step_finish" });
  assert.deepEqual(opencode.metrics(trace), { tokens: 0, cost: 0, tool_calls: 0 });
});

test("a truncated last line keeps the earlier steps", () => {
  const trace = jsonl(stepFinish(1000, 0)) + '{"type":"step_finish","part":{"tok';
  assert.equal(opencode.metrics(trace).tokens, 1000);
});
