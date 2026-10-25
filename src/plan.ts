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

/** Condition of every run when the experiment declares none. */
export const BASELINE = "baseline";

type Condition = NonNullable<Experiment["conditions"]>[number];

export interface RunSpec {
  id: string;
  experiment: string;
  /** Condition id ("baseline" when the experiment declares none). */
  condition: string;
  /** Overlay directory of the condition, or null for the repo as is. */
  overlay: string | null;
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

  // Declared conditions get their own run id segment. Without them, ids
  // keep their original shape, so runs recorded before conditions existed
  // are still found (resume, report).
  const declared = experiment.conditions !== undefined;
  const conditions: Condition[] = experiment.conditions ?? [{ id: BASELINE }];

  // Repetitions are the outer loop: a full round r1 of every cell, then r2...
  // If the run stops early, every cell has the same number of runs (±1),
  // and a drift in time (service load, model update) hits all cells alike.
  // Conditions are cells too, hence inside the repetition loop.
  for (let repetition = 1; repetition <= experiment.repetitions; repetition++) {
    for (const condition of conditions) {
      for (const agent of experiment.agents) {
        for (const model of agent.models) {
          for (const persona of experiment.prompts.personas) {
            for (const wording of experiment.prompts.wordings) {
              const id = [
                experiment.id,
                agent.id,
                modelSlug(model),
                ...(declared ? [condition.id] : []),
                `${persona}.${wording}`,
                `r${repetition}`,
              ].join("/");

              runs.push({
                id,
                experiment: experiment.id,
                condition: condition.id,
                overlay: condition.overlay ?? null,
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
