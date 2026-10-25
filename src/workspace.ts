/**
 * Workspace of one run: a fresh copy of the synthetic repo.
 *
 * Same steps as scripts/pilot-run.sh: committed content only
 * (git archive), then a new git history with a neutral author, so the
 * agent sees neither the bench nor its history.
 *
 * A condition overlay is copied between extraction and git init: it is
 * part of the initial commit, so the agent sees it as the original repo
 * and it never shows up in diff.patch.
 */
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand, type Run } from "./exec.ts";
import { applyOverlay } from "./overlay.ts";

// Branch of the initial commit. Pinned so it does not depend on the
// git config of the machine running the bench (the agent can see it).
export const WORKSPACE_BRANCH = "master";

export async function prepareWorkspace(
  repoPath: string,
  dest: string,
  run: Run = runCommand,
  overlay: string | null = null,
): Promise<void> {
  await mkdir(dest, { recursive: true });
  if ((await readdir(dest)).length > 0) {
    throw new Error(`workspace ${dest} is not empty`);
  }

  // git archive | tar -x, through a temporary file (no shell needed).
  const scratch = await mkdtemp(join(tmpdir(), "bench-archive-"));
  const archive = join(scratch, "repo.tar");
  try {
    await step(run, "git", ["archive", "--format=tar", "-o", archive, `HEAD:${repoPath}`]);
    await step(run, "tar", ["-x", "-f", archive, "-C", dest]);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }

  if (overlay !== null) await applyOverlay(overlay, dest);

  await step(run, "git", ["-C", dest, "init", "-q", "-b", WORKSPACE_BRANCH]);
  await step(run, "git", ["-C", dest, "add", "-A"]);
  await step(run, "git", [
    "-C", dest,
    "-c", "user.name=Tablo",
    "-c", "user.email=dev@tablo.example",
    "commit", "-qm", "Initial commit",
  ]);
}

async function step(run: Run, command: string, args: string[]): Promise<void> {
  const r = await run(command, args);
  if (r.code !== 0) {
    const why = (r.stderr || r.stdout).trim() || `exit ${r.code}`;
    throw new Error(`${command} ${args.join(" ")} failed: ${why}`);
  }
}
