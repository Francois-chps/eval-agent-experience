import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { containerName, opencode } from "../../src/agents/opencode.ts";
import type { TurnRunners, TurnSpec } from "../../src/agents/types.ts";
import type { LongCommand, LongResult } from "../../src/exec.ts";

const SESSION = "ses_abc123";
const OK: LongResult = { code: 0, seconds: 42.5, timedOut: false, error: null };
const TIMED_OUT: LongResult = { code: null, seconds: 1800, timedOut: true, error: null };

// A turn whose run directory is a temporary directory removed after the test.
async function turnSpec(t: TestContext): Promise<TurnSpec> {
  const dir = await mkdtemp(join(tmpdir(), "turn-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return {
    runId: "email-pilot/opencode/some-model/cto.p1/r1",
    turn: 1,
    image: "agent-bench:0.1",
    model: "opencode/some-model",
    runDir: dir,
    workspaceDir: join(dir, "workspace"),
    message: "Add a welcome email.",
  };
}

// Fake runners: runLong writes `stdout` to the turn file like docker would,
// then answers `result`. Every call is recorded.
function fakes(result: LongResult, stdout = "") {
  const long: LongCommand[] = [];
  const short: string[] = [];
  const runners: TurnRunners = {
    runLong: async (spec) => {
      long.push(spec);
      await writeFile(spec.stdoutPath, stdout);
      return result;
    },
    run: async (command, args) => {
      short.push([command, ...args].join(" "));
      return { code: 0, stdout: "", stderr: "" };
    },
  };
  return { runners, long, short };
}

test("a turn runs docker with its arguments and logs in the run directory", async (t) => {
  const spec = await turnSpec(t);
  const stdout = JSON.stringify({ type: "step_start", sessionID: SESSION }) + "\n";
  const { runners, long, short } = fakes(OK, stdout);
  const result = await opencode.runTurn(spec, 1800, runners);
  assert.deepEqual(long, [
    {
      command: "docker",
      args: opencode.turnArgs(spec),
      stdoutPath: join(spec.runDir, "turn1.jsonl"),
      stderrPath: join(spec.runDir, "turn1.stderr.log"),
      timeoutS: 1800,
    },
  ]);
  assert.deepEqual(short, []);
  assert.equal(result.code, 0);
  assert.equal(result.sessionId, SESSION);
});

test("home-local exists before docker mounts it", async (t) => {
  const spec = await turnSpec(t);
  const { runners } = fakes(OK);
  let existed = false;
  const checking: TurnRunners = {
    ...runners,
    runLong: async (command) => {
      existed = (await stat(join(spec.runDir, "home-local"))).isDirectory();
      return runners.runLong(command);
    },
  };
  await opencode.runTurn(spec, 1800, checking);
  assert.equal(existed, true);
});

test("a timed-out turn removes its container", async (t) => {
  const spec = await turnSpec(t);
  const { runners, short } = fakes(TIMED_OUT);
  const turn2 = { ...spec, turn: 2, sessionId: SESSION, message: "Sounds good, go ahead." };
  const result = await opencode.runTurn(turn2, 1800, runners);
  assert.equal(result.timedOut, true);
  assert.deepEqual(short, [`docker rm -f ${containerName(spec.runId, 2)}`]);
});

test("a failed turn keeps its exit code and removes nothing", async (t) => {
  const spec = await turnSpec(t);
  const { runners, short } = fakes({ ...OK, code: 1 });
  const result = await opencode.runTurn(spec, 1800, runners);
  assert.equal(result.code, 1);
  assert.equal(result.sessionId, undefined);
  assert.deepEqual(short, []);
});

test("a docker that cannot start is reported, not thrown", async (t) => {
  const spec = await turnSpec(t);
  const { runners } = fakes({ ...OK, code: null, error: "spawn docker ENOENT" });
  const result = await opencode.runTurn(spec, 1800, runners);
  assert.equal(result.code, null);
  assert.ok(result.error?.includes("ENOENT"), String(result.error));
});

test("a run directory that cannot be created gives an error without running docker", async (t) => {
  const spec = await turnSpec(t);
  const blocker = join(spec.runDir, "blocker");
  await writeFile(blocker, "");
  const { runners, long } = fakes(OK);
  const result = await opencode.runTurn({ ...spec, runDir: join(blocker, "r1") }, 1800, runners);
  assert.equal(result.code, null);
  assert.ok(result.error?.includes("ENOTDIR"), String(result.error));
  assert.deepEqual(long, []);
});
