/**
 * What the runner needs from an agent. Everything specific to one agent
 * (its CLI, its output format, its Docker setup) lives in its adapter.
 */
/** One turn of one run, as the runner describes it to an adapter. */
export interface TurnSpec {
  /** Stable run id from the plan, e.g. email-pilot/opencode/model/cto.p1/r1. */
  runId: string;
  /** 1 for the first turn. */
  turn: number;
  image: string;
  model: string;
  /** Directory of the run: logs, and the agent's private state. */
  runDir: string;
  /** Repo copy the agent works in. */
  workspaceDir: string;
  /** Full message for this turn, already assembled by the runner. */
  message: string;
  /** Session to resume; absent on the first turn. */
  sessionId?: string;
}

export interface AgentAdapter {
  /** Matches agents[].id in the experiment config. */
  readonly id: string;
  /** Prints the agent version inside its image; the last line is the version. */
  readonly versionCommand: readonly string[];
    /** Arguments for `docker` that run one turn. Pure: runs nothing. */
  turnArgs(spec: TurnSpec): string[];
  /** Session to resume, read from one turn's stdout; undefined if none. */
  sessionId(jsonl: string): string | undefined;

}
