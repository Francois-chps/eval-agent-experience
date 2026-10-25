/**
 * Shape of experiments/<id>.yaml.
 *
 * Field names match the YAML (and scripts/pilot-run.sh) on purpose.
 * Objects are strict: an unknown key, usually a typo, is an error
 * instead of being silently ignored.
 *
 * Only the shape is checked here. Whether files, images or hashes
 * really exist is checked later, before a run.
 */
import * as z from "zod";

const Slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "must use lowercase letters, digits and dashes");

function uniqueList(item: z.ZodString) {
  return z
    .array(item)
    .min(1)
    .refine((items) => new Set(items).size === items.length, "must not contain duplicates");
}

const Repo = z.strictObject({
  id: Slug,
  path: z.string().min(1),
  hash: z
    .string()
    .regex(/^[0-9a-f]{12}$/, "must be the 12-char hash printed by scripts/repo-hash.sh"),
});

const Agent = z.strictObject({
  id: Slug,
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be an exact version like 1.19.3"),
  image: z.string().min(1),
  models: uniqueList(z.string().min(1)),
});

const Prompts = z.strictObject({
  dir: z.string().min(1),
  personas: uniqueList(Slug),
  wordings: uniqueList(Slug),
});

const Turn = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("prompt"), suffix: z.string().min(1).optional() }),
  z.strictObject({ type: z.literal("message"), text: z.string().min(1) }),
]);

const Protocol = z.strictObject({
  turns: z
    .array(Turn)
    .min(1)
    .refine((turns) => turns[0]?.type === "prompt", "the first turn must be the prompt"),
});

const Outcome = z.strictObject({
  labels: uniqueList(Slug),
});

// A variant of the starting repo. The id becomes a run id segment (hence
// a slug). The overlay is a directory copied over the extracted repo
// before the workspace's initial commit; no overlay means the repo as is.
const Condition = z.strictObject({
  id: Slug,
  overlay: z.string().min(1).optional(),
});

export const ExperimentSchema = z.strictObject({
  id: Slug,
  category: Slug,
  repo: Repo,
  // Optional: without it, the experiment has one implicit "baseline"
  // condition and run ids keep their original shape.
  conditions: z
    .array(Condition)
    .min(1)
    .refine(
      (conditions) => new Set(conditions.map((c) => c.id)).size === conditions.length,
      "condition ids must be unique",
    )
    .optional(),
  agents: z
    .array(Agent)
    .min(1)
    .refine(
      (agents) => new Set(agents.map((a) => a.id)).size === agents.length,
      "agent ids must be unique",
    ),
  prompts: Prompts,
  protocol: Protocol,
  repetitions: z.number().int().positive(),
  timeout_s: z.number().int().positive(),
  outcome: Outcome,
});



export type Experiment = z.infer<typeof ExperimentSchema>;