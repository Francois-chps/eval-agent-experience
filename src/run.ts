/**
 * Executes runs: one directory per stable run id, turns through the agent
 * adapter, then artifacts and meta.json. A run with a valid meta.json is
 * finished and skipped, unless it was recorded under other conditions.
 */
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { findAdapter } from "./agents/index.ts";
import type { AgentAdapter, TurnResult, TurnSpec } from "./agents/types.ts";
import { saveArtifacts } from "./artifacts.ts";
import { preflight } from "./checks.ts";
import { ConfigError, loadExperiment } from "./config.ts";
import { runCommand } from "./exec.ts";
import { readMeta, writeMeta, type Meta, type TurnMeta } from "./meta.ts";
import { buildPlan, type RunSpec } from "./plan.ts";
import { loadPrompt } from "./prompt.ts";
import type { Experiment } from "./schema.ts";
import { prepareWorkspace, WORKSPACE_BRANCH } from "./workspace.ts";

export const RUNS_ROOT = "tmp/runs";

type Turn = Experiment["protocol"]["turns"][number];
type TurnBase = Omit<TurnSpec, "turn" | "message" | "sessionId">;

// Frozen in meta.json: resuming under other values would mix two experiments.
const FROZEN = ["agent_version", "image", "model", "repo_hash", "timeout_s", "workspace_branch"] as const;
export type Conditions = Pick<Meta, (typeof FROZEN)[number]>;

// docker run exits 125-127 when docker itself fails (bad flag, missing .env,
// missing command): not the agent's doing, so the run is not recorded.
const DOCKER_FAILURES = new Set([125, 126, 127]);

const SKIPPED: TurnMeta = { exit: null, seconds: 0, timed_out: false, skipped: true, error: null };

/** First turn: prompt body, a blank line, then the suffix (as the pilot). */
export function turnMessage(turn: Turn, body: string): string {
  if (turn.type === "message") return turn.text;
  return turn.suffix === undefined ? body : `${body}\n\n${turn.suffix}`;
}

export function conditionDiffs(recorded: Conditions, expected: Conditions): string[] {
  return FROZEN.filter((key) => recorded[key] !== expected[key]).map(
    (key) => `${key}: recorded ${recorded[key]}, config says ${expected[key]}`,
  );
}

export interface TurnsOutcome {
  turns: TurnMeta[];
  sessionId: string | null;
  /** stdout files of the turns that ran, in order. */
  outputs: string[];
  /** Set when docker itself failed: the run must not be recorded. */
  infraError: string | null;
}

/** A turn after the first runs only if the previous one exited 0 with a session. */
export async function runTurns(
  adapter: AgentAdapter,
  protocol: readonly Turn[],
  body: string,
  base: TurnBase,
  timeoutS: number,
): Promise<TurnsOutcome> {
  const turns: TurnMeta[] = [];
  const outputs: string[] = [];
  let sessionId: string | undefined;
  let canContinue = true;
  for (const [index, turn] of protocol.entries()) {
    if (!canContinue) {
      turns.push(SKIPPED);
      continue;
    }
    const message = turnMessage(turn, body);
    const result = await adapter.runTurn({ ...base, turn: index + 1, message, sessionId }, timeoutS);
    const infraError = dockerFailure(result);
    if (infraError !== null) return { turns, sessionId: null, outputs, infraError };
    outputs.push(result.stdoutPath);
    turns.push({
      exit: result.code,
      seconds: result.seconds,
      timed_out: result.timedOut,
      skipped: false,
      error: null,
    });
    sessionId ??= result.sessionId;
    canContinue = result.code === 0 && sessionId !== undefined;
  }
  return { turns, sessionId: sessionId ?? null, outputs, infraError: null };
}

function dockerFailure(result: TurnResult): string | null {
  if (result.error !== null) return result.error;
  if (result.code !== null && DOCKER_FAILURES.has(result.code)) {
    return `docker exited with ${result.code}, see ${result.stderrPath}`;
  }
  return null;
}

/** Runs one entry of the plan, or skips it if it is already finished. */
export async function runOne(
  experiment: Experiment,
  spec: RunSpec,
  runsRoot: string = RUNS_ROOT,
): Promise<"done" | "skipped"> {
  const agent = experiment.agents.find((candidate) => candidate.id === spec.agent);
  const adapter = findAdapter(spec.agent);
  if (agent === undefined || adapter === undefined) {
    throw new ConfigError(`no adapter for agent ${spec.agent}`);
  }
  const conditions: Conditions = {
    agent_version: agent.version,
    image: agent.image,
    model: spec.model,
    repo_hash: experiment.repo.hash,
    timeout_s: experiment.timeout_s,
    workspace_branch: WORKSPACE_BRANCH,
  };

  const runDir = join(runsRoot, spec.id);
  const metaPath = join(runDir, "meta.json");
  const previous = await readMeta(metaPath);
  if (previous.status === "invalid") {
    throw new ConfigError(`${metaPath} is invalid (delete ${runDir} to rerun it):\n${previous.reason}`);
  }
  if (previous.status === "ok") {
    const diffs = conditionDiffs(previous.meta, conditions);
    if (diffs.length > 0) {
      throw new ConfigError(`${spec.id} was recorded under other conditions:\n  ${diffs.join("\n  ")}`);
    }
    return "skipped";
  }

  const prompt = await loadPrompt(spec.promptPath);
  if (prompt.category !== experiment.category) {
    throw new ConfigError(`${spec.promptPath} is not a ${experiment.category} prompt`);
  }

  // No valid meta.json: whatever is there comes from an interrupted run.
  await rm(runDir, { recursive: true, force: true });
  const workspaceDir = join(runDir, "workspace");
  await mkdir(workspaceDir, { recursive: true });
  await prepareWorkspace(experiment.repo.path, workspaceDir, runCommand);

  console.error(`run ${spec.id}`);
  const startedAt = new Date().toISOString();
  const base: TurnBase = { runId: spec.id, image: agent.image, model: spec.model, runDir, workspaceDir };
  const body = prompt.body.trim();
  const outcome = await runTurns(adapter, experiment.protocol.turns, body, base, experiment.timeout_s);
  if (outcome.infraError !== null) throw new Error(`${spec.id}: ${outcome.infraError}`);

  const artifacts = await saveArtifacts(runDir, workspaceDir, outcome.outputs);
  await writeMeta(metaPath, {
    run_id: spec.id,
    experiment: experiment.id,
    prompt_id: prompt.id,
    persona: spec.persona,
    wording: spec.wording,
    repetition: spec.repetition,
    agent: spec.agent,
    ...conditions,
    session_id: outcome.sessionId,
    started_at: startedAt,
    turns: outcome.turns,
    ...adapter.metrics(artifacts.trace),
    agent_files_written: artifacts.agentFilesWritten,
  });
  const summary = outcome.turns.map((t) => (t.skipped ? "skipped" : t.timed_out ? "timeout" : `exit ${t.exit}`));
  console.error(`  turns: ${summary.join(", ")}`);
  return "done";
}

/** Preflight, then every run of the plan in order. Returns the exit code. */
export async function runExperiment(configPath: string, runsRoot: string = RUNS_ROOT): Promise<number> {
  const experiment = await loadExperiment(configPath);
  const plan = buildPlan(experiment);
  const checks = await preflight(experiment);
  for (const check of checks) {
    console.error(`${check.ok ? "ok  " : "FAIL"}  ${check.name}: ${check.detail}`);
  }
  if (checks.some((check) => !check.ok)) return 1;

  let done = 0;
  let skipped = 0;
  for (const spec of plan) {
    if ((await runOne(experiment, spec, runsRoot)) === "done") done += 1;
    else skipped += 1;
  }
  console.error(`${done} run(s) done, ${skipped} already finished`);
  return 0;
}
