/**
 * meta.json: one file per finished run, with the frozen conditions and
 * the metrics. Field names match scripts/pilot-run.sh so the same jq
 * queries work on pilot runs and runner runs.
 *
 * Differences with the pilot: a timed-out or skipped turn has exit null
 * (the pilot used 124 and -1), with timed_out / skipped saying which.
 */
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

const TurnSchema = z.strictObject({
  /** Exit code, or null if killed, skipped or not started. */
  exit: z.number().int().nullable(),
  seconds: z.number().nonnegative(),
  timed_out: z.boolean(),
  skipped: z.boolean(),
  /** Why the turn could not start (e.g. docker missing), or null. */
  error: z.string().nullable(),
});

export const MetaSchema = z.strictObject({
  run_id: z.string().min(1),
  experiment: z.string().min(1),
  prompt_id: z.string().min(1),
  persona: z.string().min(1),
  wording: z.string().min(1),
  repetition: z.number().int().positive(),
  agent: z.string().min(1),
  agent_version: z.string().min(1),
  model: z.string().min(1),
  image: z.string().min(1),
  repo_hash: z.string().regex(/^[0-9a-f]{12}$/),
  workspace_branch: z.string().min(1),
  session_id: z.string().nullable(),
  started_at: z.iso.datetime(),
  timeout_s: z.number().positive(),
  turns: z.array(TurnSchema).min(1),
  tokens: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  tool_calls: z.number().int().nonnegative(),
  agent_files_written: z.number().int().nonnegative(),
});

export type Meta = z.infer<typeof MetaSchema>;
export type TurnMeta = z.infer<typeof TurnSchema>;

export type MetaRead =
  | { status: "missing" }
  | { status: "invalid"; reason: string }
  | { status: "ok"; meta: Meta };

/** Validates before writing: an incomplete meta.json never reaches the disk. */
export async function writeMeta(path: string, meta: Meta): Promise<void> {
  const checked = MetaSchema.parse(meta);
  await writeFile(path, `${JSON.stringify(checked, null, 2)}\n`);
}

/** A run is finished when its meta.json reads as "ok". Never throws. */
export async function readMeta(path: string): Promise<MetaRead> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) return { status: "missing" };
    return { status: "invalid", reason: messageOf(error) };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { status: "invalid", reason: `not valid JSON: ${messageOf(error)}` };
  }

  const parsed = MetaSchema.safeParse(json);
  return parsed.success
    ? { status: "ok", meta: parsed.data }
    : { status: "invalid", reason: z.prettifyError(parsed.error) };
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
