import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveArtifacts } from "../../src/artifacts.ts";

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

test("artifacts hold the whole trace and every change of the agent", async (t) => {
  const runDir = await mkdtemp(join(tmpdir(), "artifacts-"));
  t.after(() => rm(runDir, { recursive: true, force: true }));
  const ws = join(runDir, "workspace");
  await mkdir(ws);
  git(ws, "init", "-q");
  await writeFile(join(ws, "README.md"), "Tablo\n");
  git(ws, "add", "-A");
  git(ws, "-c", "user.name=Tablo", "-c", "user.email=dev@tablo.example", "commit", "-qm", "Initial commit");

  // What an agent might do: edit a file, add code, write an AGENTS.md at the root.
  await writeFile(join(ws, "README.md"), "Tablo, now with emails\n");
  await mkdir(join(ws, "src"));
  await writeFile(join(ws, "src", "email.ts"), "export {};\n");
  await writeFile(join(ws, "AGENTS.md"), "# Notes\n");

  const turn1 = join(runDir, "turn1.jsonl");
  const turn2 = join(runDir, "turn2.jsonl");
  await writeFile(turn1, '{"type":"step_start"}\n');
  await writeFile(turn2, '{"type":"step_finish"}\n');

  const artifacts = await saveArtifacts(runDir, ws, [turn1, turn2]);

  const trace = '{"type":"step_start"}\n{"type":"step_finish"}\n';
  assert.equal(artifacts.trace, trace);
  assert.equal(await readFile(join(runDir, "trace.jsonl"), "utf8"), trace);
  const files = (await readFile(join(runDir, "files.txt"), "utf8")).trim().split("\n");
  assert.deepEqual(files, ["A\tAGENTS.md", "M\tREADME.md", "A\tsrc/email.ts"]);
  assert.equal(artifacts.agentFilesWritten, 1);
  const diff = await readFile(join(runDir, "diff.patch"), "utf8");
  assert.ok(diff.includes("+Tablo, now with emails"), diff);
});
