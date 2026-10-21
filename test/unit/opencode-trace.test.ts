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
