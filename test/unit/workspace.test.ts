import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Run } from "../../src/exec.ts";
import { prepareWorkspace } from "../../src/workspace.ts";

function fake(failOn?: string) {
  const calls: string[] = [];
  const run: Run = async (command, args) => {
    const key = [command, ...args].join(" ");
    calls.push(key);
    if (failOn !== undefined && key.includes(failOn)) {
      return { code: 1, stdout: "", stderr: "boom" };
    }
    return { code: 0, stdout: "", stderr: "" };
  };
  return { run, calls };
}

async function emptyDir(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "ws-")), "workspace");
}

test("runs the same steps as pilot-run.sh, in order", async () => {
  const dest = await emptyDir();
  const { run, calls } = fake();
  await prepareWorkspace("repos/nextjs-saas-startup", dest, run);
  assert.equal(calls.length, 5);
  assert.match(calls[0]!, /^git archive --format=tar -o .+ HEAD:repos\/nextjs-saas-startup$/);
  assert.match(calls[1]!, /^tar -x -f .+ -C /);
  assert.equal(calls[2], `git -C ${dest} init -q -b master`);
  assert.equal(calls[3], `git -C ${dest} add -A`);
  assert.equal(
    calls[4],
    `git -C ${dest} -c user.name=Tablo -c user.email=dev@tablo.example commit -qm Initial commit`,
  );
});

test("a failing step stops and reports the command", async () => {
  const { run, calls } = fake("archive");
  await assert.rejects(prepareWorkspace("repos/x", await emptyDir(), run), /git archive .* failed: boom/);
  assert.equal(calls.length, 1, "nothing runs after a failure");
});

test("refuses a workspace that is not empty", async () => {
  const dest = await mkdtemp(join(tmpdir(), "ws-"));
  await writeFile(join(dest, "leftover.txt"), "x");
  const { run, calls } = fake();
  await assert.rejects(prepareWorkspace("repos/x", dest, run), /not empty/);
  assert.equal(calls.length, 0);
});
