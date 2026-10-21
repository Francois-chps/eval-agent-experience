import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { containerName, opencode } from "../../src/agents/opencode.ts";
import type { TurnSpec } from "../../src/agents/types.ts";

const TURN1: TurnSpec = {
  runId: "email-pilot/opencode/some-model/cto.p1/r1",
  turn: 1,
  image: "agent-bench:0.1",
  model: "opencode/some-model",
  runDir: "/runs/r1",
  workspaceDir: "/runs/r1/workspace",
  message: "Add a welcome email.\n\nBefore writing any code, reply with a short plan.",
};

test("turn 1 matches the pilot's docker run, flag for flag", () => {
  assert.deepEqual(opencode.turnArgs(TURN1), [
    "run",
    "--rm",
    "--name",
    "bench-email-pilot.opencode.some-model.cto.p1.r1-t1",
    "--env-file",
    ".env",
    "-e",
    "NEXT_TELEMETRY_DISABLED=1",
    "-v",
    "/runs/r1/workspace:/app",
    "-v",
    "/runs/r1/home-local:/home/node/.local",
    "agent-bench:0.1",
    "opencode",
    "run",
    "--format",
    "json",
    "--model",
    "opencode/some-model",
    "Add a welcome email.\n\nBefore writing any code, reply with a short plan.",
  ]);
});

test("turn 2 resumes the session, right before the message", () => {
  const args = opencode.turnArgs({
    ...TURN1,
    turn: 2,
    sessionId: "ses_abc123",
    message: "Sounds good, go ahead.",
  });
  assert.deepEqual(args.slice(-3), ["--session", "ses_abc123", "Sounds good, go ahead."]);
  assert.ok(args.includes("bench-email-pilot.opencode.some-model.cto.p1.r1-t2"));
});

test("the message stays one argument, newlines included", () => {
  const args = opencode.turnArgs(TURN1);
  assert.equal(args.at(-1), TURN1.message);
  assert.equal(args.includes("--session"), false);
});

test("container names only use characters docker accepts", () => {
  const name = containerName("exp/agent/vendor:model@1/cto.p1/r12", 3);
  assert.match(name, /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
  assert.equal(name, "bench-exp.agent.vendor.model.1.cto.p1.r12-t3");
});

test("relative directories become absolute volume paths", () => {
  const args = opencode.turnArgs({ ...TURN1, runDir: "tmp/r1", workspaceDir: "tmp/r1/workspace" });
  assert.ok(args.includes(`${resolve("tmp/r1/workspace")}:/app`));
  assert.ok(args.includes(`${resolve("tmp/r1/home-local")}:/home/node/.local`));
});
