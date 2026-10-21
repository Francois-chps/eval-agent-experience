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

export const opencode: AgentAdapter = {
  id: "opencode",
  versionCommand: ["opencode", "--version"],
  turnArgs,
};
