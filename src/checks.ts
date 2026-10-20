/**
 * Preflight checks: refuse to start runs whose conditions differ from
 * the experiment config. Commands match scripts/pilot-run.sh.
 *
 * Every check runs and reports, so all problems show up at once.
 */
import { runCommand, type CommandResult, type Run } from "./exec.ts";
import type { Experiment } from "./schema.ts";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

// How to print each agent's version inside its image.
// Moves into the agent adapter when adapters exist.
const VERSION_COMMANDS: Record<string, string[]> = {
  opencode: ["opencode", "--version"],
};

export async function preflight(
  experiment: Experiment,
  run: Run = runCommand,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { path, hash: expectedHash } = experiment.repo;

  const hash = await run("scripts/repo-hash.sh", [path]);
  const actualHash = lastLine(hash.stdout);
  if (hash.code !== 0) {
    results.push(fail("repo hash", `repo-hash.sh failed: ${output(hash)}`));
  } else if (actualHash !== expectedHash) {
    results.push(fail("repo hash", `${path} is ${actualHash}, experiment expects ${expectedHash}`));
  } else {
    results.push(pass("repo hash", `${path} is ${actualHash}`));
  }

  const neutral = await run("scripts/check-neutrality.sh", [path]);
  results.push(
    neutral.code === 0
      ? pass("neutrality", `${path} is neutral`)
      : fail("neutrality", output(neutral)),
  );

  for (const agent of experiment.agents) {
    const image = await run("docker", ["image", "inspect", "--format", "{{.Id}}", agent.image]);
    if (image.code !== 0) {
      results.push(fail(`${agent.id} image`, `${agent.image} not found locally: ${output(image)}`));
      continue; // no point asking a missing image for its version
    }
    results.push(pass(`${agent.id} image`, agent.image));

    const versionCommand = VERSION_COMMANDS[agent.id];
    if (versionCommand === undefined) {
      results.push(fail(`${agent.id} version`, `no version command known for agent ${agent.id}`));
      continue;
    }
    const version = await run("docker", ["run", "--rm", agent.image, ...versionCommand]);
    const actualVersion = lastLine(version.stdout);
    results.push(
      version.code === 0 && actualVersion === agent.version
        ? pass(`${agent.id} version`, actualVersion)
        : fail(
            `${agent.id} version`,
            version.code === 0
              ? `image has ${actualVersion}, experiment expects ${agent.version}`
              : output(version),
          ),
    );
  }

  return results;
}

function pass(name: string, detail: string): CheckResult {
  return { name, ok: true, detail };
}

function fail(name: string, detail: string): CheckResult {
  return { name, ok: false, detail };
}

function lastLine(text: string): string {
  return text.trim().split("\n").at(-1)?.trim() ?? "";
}

// First lines of what a failed command printed, for the error message.
function output(r: CommandResult): string {
  const text = `${r.stdout}\n${r.stderr}`.trim();
  if (text === "") return `exit ${r.code}`;
  return text.split("\n").slice(0, 5).join("\n  ");
}
