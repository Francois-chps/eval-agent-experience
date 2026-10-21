/**
 * Run artifacts, like the "Artifacts" block of scripts/pilot-run.sh:
 * trace.jsonl (all turns), diff.patch and files.txt (what the agent changed).
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCommand, type Run } from "./exec.ts";

export interface Artifacts {
  /** All turns concatenated, as written to trace.jsonl. */
  trace: string;
  agentFilesWritten: number;
}

const AGENT_FILES = new Set(["AGENTS.md", "CLAUDE.md"]);

/**
 * Counts agent instruction files added or modified, from `--name-status`
 * lines such as "A<tab>AGENTS.md". The pilot's grep missed root files: the
 * path follows a tab, not a slash.
 */
export function countAgentFiles(nameStatus: string): number {
  return nameStatus.split("\n").filter((line) => {
    const fields = line.split("\t");
    const name = fields.at(-1)?.split("/").at(-1) ?? "";
    return fields[0]?.startsWith("D") !== true && AGENT_FILES.has(name);
  }).length;
}

/** Throws if git fails: a run without its diff is not a finished run. */
export async function saveArtifacts(
  runDir: string,
  workspaceDir: string,
  turnOutputs: readonly string[],
  run: Run = runCommand,
): Promise<Artifacts> {
  const parts = await Promise.all(turnOutputs.map((path) => readFile(path, "utf8").catch(() => "")));
  const trace = parts.join("");
  await writeFile(join(runDir, "trace.jsonl"), trace);

  await git(run, workspaceDir, ["add", "-A"]);
  const diff = await git(run, workspaceDir, ["diff", "--cached"]);
  const files = await git(run, workspaceDir, ["diff", "--cached", "--name-status"]);
  await writeFile(join(runDir, "diff.patch"), diff);
  await writeFile(join(runDir, "files.txt"), files);
  return { trace, agentFilesWritten: countAgentFiles(files) };
}

async function git(run: Run, cwd: string, args: string[]): Promise<string> {
  const result = await run("git", ["-C", cwd, ...args]);
  if (result.code !== 0) {
    throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}
