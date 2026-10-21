/**
 * Expand an experiment into the list of runs it describes.
 *
 * Pure function: no disk access, and the same config always gives the
 * same runs in the same order. Run ids only depend on the config, so a
 * retry lands on the same run instead of creating a new one.
 */
import { join } from "node:path";
import { ConfigError } from "./config.ts";
import type { Experiment } from "./schema.ts";

export interface RunSpec {
  id: string;
  experiment: string;
  agent: Experiment["agents"][number];
  model: string;
  persona: string;
  wording: string;
  repetition: number;
  promptPath: string;
}

/** "opencode/big-pickle" -> "opencode-big-pickle" (safe as a folder name). */
export function modelSlug(model: string): string {
  return model.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
}

export function buildPlan(experiment: Experiment): RunSpec[] {
  const runs: RunSpec[] = [];

  // Repetitions are the outer loop: a full round r1 of every cell, then r2...
  // If the run stops early, every cell has the same number of runs (±1),
  // and a drift in time (service load, model update) hits all cells alike.
  for (let repetition = 1; repetition <= experiment.repetitions; repetition++) {
    for (const agent of experiment.agents) {
      for (const model of agent.models) {
        for (const persona of experiment.prompts.personas) {
          for (const wording of experiment.prompts.wordings) {
            const id = [
              experiment.id,
              agent.id,
              modelSlug(model),
              `${persona}.${wording}`,
              `r${repetition}`,
            ].join("/");

            runs.push({
              id,
              experiment: experiment.id,
              agent,
              model,
              persona,
              wording,
              repetition,
              promptPath: join(experiment.prompts.dir, `${persona}.${wording}.md`),
            });
          }
        }
      }
    }
  }

  const seen = new Set<string>();
  for (const run of runs) {
    if (seen.has(run.id)) {
      throw new ConfigError(`two runs share the id ${run.id} (check model names)`);
    }
    seen.add(run.id);
  }

  return runs;
}
