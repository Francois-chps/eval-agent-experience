/**
 * What the runner needs from an agent. Everything specific to one agent
 * (its CLI, its output format, its Docker setup) lives in its adapter.
 */
export interface AgentAdapter {
  /** Matches agents[].id in the experiment config. */
  readonly id: string;
  /** Prints the agent version inside its image; the last line is the version. */
  readonly versionCommand: readonly string[];
}
