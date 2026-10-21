/**
 * Reading experiment files from disk.
 *
 * Everything that comes from outside the program is `unknown` until a
 * schema has validated it (next commit). Any problem with the file
 * becomes a ConfigError: the CLI shows its message, without a stack.
 */
import { readFile } from "node:fs/promises";
import { parse } from "yaml";

import * as z from "zod";
import { ExperimentSchema, type Experiment } from "./schema.ts";

export class ConfigError extends Error {
  name = "ConfigError";
}

export async function readYamlFile(path: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new ConfigError(`cannot read ${path}: ${describe(error)}`, {
      cause: error,
    });
  }

  try {
    return parse(text);
  } catch (error) {
    throw new ConfigError(`invalid YAML in ${path}: ${describe(error)}`, {
      cause: error,
    });
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadExperiment(path: string): Promise<Experiment> {
  const data = await readYamlFile(path);
  const result = ExperimentSchema.safeParse(data);
  if (!result.success) {
    throw new ConfigError(
      `invalid experiment ${path}:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}



