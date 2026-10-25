/**
 * Preflight checks: refuse to start runs whose conditions differ from
 * the experiment config. Commands match scripts/pilot-run.sh.
 *
 * Every check runs and reports, so all problems show up at once.
 */
import { runCommand, type CommandResult, type Run } from "./exec.ts";
import type { Experiment } from "./schema.ts";
import { findAdapter } from "./agents/index.ts";
import { listOverlay } from "./overlay.ts";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export async function preflight(
  experiment: Experiment,
  run: Run = runCommand,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { path, hash: expectedHash } = experiment.repo;
  const status = await run("git", ["status", "--porcelain", "--", path]);
  if (status.code !== 0) {
    results.push(fail("repo committed", `git status failed: ${output(status)}`));
  } else if (status.stdout.trim() !== "") {
    results.push(
      fail("repo committed", `uncommitted changes in ${path} (runs use committed content only)`),
    );
  } else {
    results.push(pass("repo committed", `${path} has no uncommitted changes`));
  }

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


  // Overlays are checked up front: a missing fixture fails now, not after
  // the first runs of the other conditions.
  for (const condition of experiment.conditions ?? []) {
    if (condition.overlay === undefined) continue;
    const name = `overlay ${condition.id}`;
    try {
      const files = await listOverlay(condition.overlay);
      results.push(pass(name, `${condition.overlay}: ${files.join(", ")}`));
    } catch (error) {
      results.push(fail(name, error instanceof Error ? error.message : String(error)));
    }
  }

  for (const agent of experiment.agents) {
    const image = await run("docker", ["image", "inspect", "--format", "{{.Id}}", agent.image]);
    if (image.code !== 0) {
      results.push(fail(`${agent.id} image`, `${agent.image} not found locally: ${output(image)}`));
      continue; // no point asking a missing image for its version
    }
    results.push(pass(`${agent.id} image`, agent.image));

    const adapter = findAdapter(agent.id);
    if (adapter === undefined) {
      results.push(fail(`${agent.id} version`, `no version command known for agent ${agent.id}`));
      continue;
    }
    const version = await run("docker", ["run", "--rm", agent.image, ...adapter.versionCommand]);

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
