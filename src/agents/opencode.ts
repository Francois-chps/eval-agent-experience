import { join, resolve } from "node:path";
import type { AgentAdapter, TurnSpec } from "./types.ts";

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

export const opencode: AgentAdapter = {
  id: "opencode",
  versionCommand: ["opencode", "--version"],
  turnArgs, sessionId,
};
