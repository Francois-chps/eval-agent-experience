import { test } from "node:test";
import assert from "node:assert/strict";
import { opencode } from "../../src/agents/opencode.ts";
import type { AgentAdapter, TurnResult, TurnSpec } from "../../src/agents/types.ts";
import { loadExperiment } from "../../src/config.ts";
import { conditionDiffs, runTurns, turnMessage, type Conditions } from "../../src/run.ts";

const pilot = await loadExperiment("experiments/email-pilot.yaml");
const PROTOCOL = pilot.protocol.turns;
const SESSION = "ses_abc123";
const BASE = { runId: "exp/a/m/cto.p1/r1", image: "img", model: "m", runDir: "d", workspaceDir: "w" };

// Fake adapter: answers each turn with a success, unless overridden.
function fakeAdapter(...answers: Partial<TurnResult>[]) {
  const specs: TurnSpec[] = [];
  const adapter: AgentAdapter = {
    ...opencode,
    runTurn: async (spec) => {
      specs.push(spec);
      return {
        code: 0,
        seconds: 1,
        timedOut: false,
        error: null,
        stdoutPath: `turn${spec.turn}.jsonl`,
        stderrPath: `turn${spec.turn}.stderr.log`,
        sessionId: SESSION,
        ...answers[specs.length - 1],
      };
    },
  };
  return { adapter, specs };
}

test("the first message is the body, a blank line, then the suffix", () => {
  assert.equal(turnMessage({ type: "prompt", suffix: "Plan first." }, "Add emails."), "Add emails.\n\nPlan first.");
  assert.equal(turnMessage({ type: "prompt" }, "Add emails."), "Add emails.");
  assert.equal(turnMessage({ type: "message", text: "Go ahead." }, "Add emails."), "Go ahead.");
});

test("turn 2 resumes the session of turn 1 with the approval", async () => {
  const { adapter, specs } = fakeAdapter();
  const outcome = await runTurns(adapter, PROTOCOL, "Add emails.", BASE, 1800);
  assert.equal(specs.length, 2);
  assert.equal(specs[0]?.sessionId, undefined);
  assert.equal(specs[1]?.sessionId, SESSION);
  assert.equal(specs[1]?.message, "Sounds good, go ahead.");
  assert.deepEqual(outcome.outputs, ["turn1.jsonl", "turn2.jsonl"]);
  assert.equal(outcome.sessionId, SESSION);
  assert.equal(outcome.infraError, null);
});

test("a failed first turn skips the second", async () => {
  const { adapter, specs } = fakeAdapter({ code: 1 });
  const outcome = await runTurns(adapter, PROTOCOL, "Add emails.", BASE, 1800);
  assert.equal(specs.length, 1);
  assert.deepEqual(
    outcome.turns.map((t) => [t.exit, t.skipped]),
    [[1, false], [null, true]],
  );
});

test("a first turn without a session skips the second", async () => {
  const { adapter, specs } = fakeAdapter({ sessionId: undefined });
  const outcome = await runTurns(adapter, PROTOCOL, "Add emails.", BASE, 1800);
  assert.equal(specs.length, 1);
  assert.equal(outcome.sessionId, null);
});

test("a timed-out first turn is recorded and skips the second", async () => {
  const { adapter } = fakeAdapter({ code: null, timedOut: true });
  const outcome = await runTurns(adapter, PROTOCOL, "Add emails.", BASE, 1800);
  assert.equal(outcome.turns[0]?.timed_out, true);
  assert.equal(outcome.turns[1]?.skipped, true);
});

test("a docker failure is an infrastructure error, not an agent result", async () => {
  for (const answer of [{ code: null, error: "spawn docker ENOENT" }, { code: 125 }]) {
    const { adapter } = fakeAdapter(answer);
    const outcome = await runTurns(adapter, PROTOCOL, "Add emails.", BASE, 1800);
    assert.notEqual(outcome.infraError, null);
    assert.deepEqual(outcome.turns, []);
  }
});

test("only frozen conditions that differ are reported", () => {
  const recorded: Conditions = {
    agent_version: "1.19.3",
    image: "agent-bench:0.1",
    model: "m",
    repo_hash: "7e73ee6a7ade",
    timeout_s: 1800,
    workspace_branch: "master",
  };
  assert.deepEqual(conditionDiffs(recorded, { ...recorded }), []);
  const diffs = conditionDiffs(recorded, { ...recorded, agent_version: "1.20.0", timeout_s: 600 });
  assert.equal(diffs.length, 2);
  assert.ok(diffs[0]?.includes("1.20.0"), diffs[0]);
});
