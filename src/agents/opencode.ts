import { join, resolve } from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { runCommand, runLongCommand } from "../exec.ts";
import type { AgentAdapter, TraceMetrics, TurnResult, TurnRunners, TurnSpec } from "./types.ts";


// Same as scripts/pilot-run.sh, so runs stay comparable with the pilot.
const ENV_FILE = ".env";
// OpenCode keeps its session database in ~/.local: turn 2 resumes turn 1.
const HOME_LOCAL = "home-local";

/** Docker only accepts [a-zA-Z0-9_.-] in names: anything else becomes ".". */
export function containerName(runId: string, turn: number): string {
  return `bench-${runId.replace(/[^a-zA-Z0-9_.-]/g, ".")}-t${turn}`;
}

/** Host directory mounted as the agent's ~/.local. */
export function homeLocalDir(runDir: string): string {
  return join(resolve(runDir), HOME_LOCAL);
}

function turnArgs(spec: TurnSpec): string[] {
  const session = spec.sessionId === undefined ? [] : ["--session", spec.sessionId];
  return [
    "run",
    "--rm",
    "--name",
    containerName(spec.runId, spec.turn),
    "--env-file",
    ENV_FILE,
    "-e",
    "NEXT_TELEMETRY_DISABLED=1",
    // docker -v needs absolute host paths.
    "-v",
    `${resolve(spec.workspaceDir)}:/app`,
    "-v",
    `${homeLocalDir(spec.runDir)}:/home/node/.local`,
    spec.image,
    "opencode",
    "run",
    "--format",
    "json",
    "--model",
    spec.model,
    ...session,
    spec.message,
  ];
}
type TraceEvent = Record<string, unknown>;

/**
 * One JSON object per line. Blank and invalid lines are skipped: a turn
 * killed at the timeout often ends in the middle of a line.
 */
function events(jsonl: string): TraceEvent[] {
  const result: TraceEvent[] = [];
  for (const line of jsonl.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const value: unknown = JSON.parse(line);
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        result.push(value as TraceEvent);
      }
    } catch {
      // Not JSON: skip the line, keep the others.
    }
  }
  return result;
}

/** Like the pilot: the first event carrying a session id. */
function sessionId(jsonl: string): string | undefined {
  for (const event of events(jsonl)) {
    if (typeof event.sessionID === "string" && event.sessionID !== "") return event.sessionID;
  }
  return undefined;
}

/** Same rules as the pilot's jq queries; a missing value counts as 0. */
function metrics(trace: string): TraceMetrics {
  const result: TraceMetrics = { tokens: 0, cost: 0, tool_calls: 0 };
  for (const event of events(trace)) {
    if (event.type === "tool_use") result.tool_calls += 1;
    if (event.type !== "step_finish") continue;
    result.tokens += numberOrZero(field(field(event.part, "tokens"), "total"));
    result.cost += numberOrZero(field(event.part, "cost"));
  }
  return result;
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const REAL_RUNNERS: TurnRunners = { run: runCommand, runLong: runLongCommand };

/** One turn, like run_turn in scripts/pilot-run.sh. Never throws. */
async function runTurn(
  spec: TurnSpec,
  timeoutS: number,
  runners: TurnRunners = REAL_RUNNERS,
): Promise<TurnResult> {
  const stdoutPath = join(spec.runDir, `turn${spec.turn}.jsonl`);
  const stderrPath = join(spec.runDir, `turn${spec.turn}.stderr.log`);
  try {
    // Created here, not by docker -v: docker would create it as root and
    // OpenCode (uid 1000) could not write its session database.
    await mkdir(homeLocalDir(spec.runDir), { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      code: null,
      seconds: 0,
      timedOut: false,
      error: message,
      stdoutPath,
      stderrPath,
      sessionId: undefined,
    };
  }

  const result = await runners.runLong({
    command: "docker",
    args: turnArgs(spec),
    stdoutPath,
    stderrPath,
    timeoutS,
  });
  if (result.timedOut) {
    // Killing the docker client does not always stop the container.
    await runners.run("docker", ["rm", "-f", containerName(spec.runId, spec.turn)]);
  }
  const output = await readFile(stdoutPath, "utf8").catch(() => "");
  return { ...result, stdoutPath, stderrPath, sessionId: sessionId(output) };
}

export const opencode: AgentAdapter = {
  id: "opencode",
  versionCommand: ["opencode", "--version"],
  turnArgs, sessionId, metrics, runTurn,
};
