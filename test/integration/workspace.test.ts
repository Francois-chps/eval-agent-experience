import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadExperiment } from "../../src/config.ts";
import { runCommand } from "../../src/exec.ts";
import { prepareWorkspace } from "../../src/workspace.ts";

const pilot = await loadExperiment("experiments/email-pilot.yaml");

// Runs git inside `cwd` and returns its trimmed output; fails the test on error.
function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("workspace holds committed Tablo with a fresh, neutral history", async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), "ws-"));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const dest = join(tmp, "workspace");

  await prepareWorkspace(pilot.repo.path, dest, runCommand);

  // One commit, on the branch the pilot used, by the fictional Tablo team.
  assert.equal(git(dest, "rev-list", "--count", "HEAD"), "1");
  assert.equal(git(dest, "branch", "--show-current"), "master");
  assert.equal(
    git(dest, "log", "-1", "--format=%an <%ae> %s"),
    "Tablo <dev@tablo.example> Initial commit",
  );
  assert.equal(git(dest, "status", "--porcelain"), "");

  // The script inspects the git repo of its working directory, so run it
  // from inside the workspace: it then checks exactly what the agent sees.
  const neutrality = spawnSync(resolve("scripts/check-neutrality.sh"), ["."], {
    cwd: dest,
    encoding: "utf8",
  });
  assert.equal(neutrality.status, 0, neutrality.stdout + neutrality.stderr);
});
