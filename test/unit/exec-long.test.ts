import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLongCommand, type LongCommand } from "../../src/exec.ts";

// Runs a small Node script as the "long command", with its output files
// in a temporary directory removed after the test.
async function runScript(t: TestContext, script: string, options: Partial<LongCommand> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "long-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const stdoutPath = join(dir, "turn1.jsonl");
  const stderrPath = join(dir, "turn1.stderr.log");
  const result = await runLongCommand({
    command: process.execPath,
    args: ["-e", script],
    stdoutPath,
    stderrPath,
    timeoutS: 10,
    ...options,
  });
  const read = (path: string) => readFile(path, "utf8").catch(() => "");
  return { result, stdout: await read(stdoutPath), stderr: await read(stderrPath) };
}

// Keeps the process alive until it is killed.
const FOREVER = "setInterval(() => {}, 1000);";

test("a successful command writes stdout and stderr to their files", async (t) => {
  const { result, stdout, stderr } = await runScript(
    t,
    'console.log("{\\"type\\":\\"step\\"}"); console.error("warning");',
  );
  assert.deepEqual({ ...result, seconds: 0 }, { code: 0, seconds: 0, timedOut: false, error: null });
  assert.equal(stdout, '{"type":"step"}\n');
  assert.equal(stderr, "warning\n");
});

test("a failing command reports its exit code", async (t) => {
  const { result } = await runScript(t, "process.exit(3);");
  assert.equal(result.code, 3);
  assert.equal(result.timedOut, false);
});

test("a command over the timeout is stopped and flagged", async (t) => {
  const { result } = await runScript(t, FOREVER, { timeoutS: 0.5 });
  assert.equal(result.timedOut, true);
  assert.equal(result.code, null);
  assert.ok(result.seconds >= 0.5 && result.seconds < 5, `took ${result.seconds}s`);
});

test("output written before a timeout is kept", async (t) => {
  const { result, stdout } = await runScript(t, `console.log("partial"); ${FOREVER}`, {
    timeoutS: 0.5,
  });
  assert.equal(result.timedOut, true);
  assert.equal(stdout, "partial\n");
});

test("a command that ignores SIGTERM is killed after the grace period", async (t) => {
  const { result } = await runScript(t, `process.on("SIGTERM", () => {}); ${FOREVER}`, {
    timeoutS: 0.5,
    killGraceS: 0.3,
  });
  assert.equal(result.timedOut, true);
  assert.ok(result.seconds < 5, `took ${result.seconds}s`);
});

test("a missing command gives an error instead of throwing", async (t) => {
  const { result } = await runScript(t, "", { command: "no-such-command-xyz" });
  assert.equal(result.code, null);
  assert.equal(result.timedOut, false);
  assert.ok(result.error?.includes("ENOENT"), String(result.error));
});

test("an output file that cannot be created gives an error instead of throwing", async (t) => {
  const { result } = await runScript(t, "", { stdoutPath: "/no-such-dir/turn1.jsonl" });
  assert.equal(result.code, null);
  assert.ok(result.error?.includes("ENOENT"), String(result.error));
});
