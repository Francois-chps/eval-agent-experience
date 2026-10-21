/**
 * Prompt files: prompts/<category>/<persona>.<wording>.md
 *
 * A YAML front-matter block between two `---` lines describes the
 * prompt. Everything after it is the body sent to the agent.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parse } from "yaml";
import * as z from "zod";
import { ConfigError } from "./config.ts";

const Name = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must use lowercase letters, digits and dashes");

const FrontMatter = z
  .strictObject({
    id: z.string().min(1),
    category: Name,
    persona: Name,
    wording: Name,
  })
  .refine(
    (fm) => fm.id === `${fm.category}.${fm.persona}.${fm.wording}`,
    "id must be <category>.<persona>.<wording>",
  );

export type Prompt = z.infer<typeof FrontMatter> & { path: string; body: string };

const BLOCK = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export async function loadPrompt(path: string): Promise<Prompt> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new ConfigError(`cannot read ${path}: ${message(error)}`, { cause: error });
  }

  const match = BLOCK.exec(text.replace(/\r\n/g, "\n"));
  if (match === null) {
    throw new ConfigError(`${path}: missing front-matter (a --- block at the top)`);
  }
  const [, header = "", rest = ""] = match;

  let data: unknown;
  try {
    data = parse(header);
  } catch (error) {
    throw new ConfigError(`invalid front-matter in ${path}: ${message(error)}`, { cause: error });
  }

  const result = FrontMatter.safeParse(data);
  if (!result.success) {
    throw new ConfigError(`invalid front-matter in ${path}:\n${z.prettifyError(result.error)}`);
  }

  const expected = `${result.data.persona}.${result.data.wording}.md`;
  if (basename(path) !== expected) {
    throw new ConfigError(`${path}: front-matter says ${expected}, file name differs`);
  }

  const body = rest.trim();
  if (body === "") {
    throw new ConfigError(`${path}: empty prompt body`);
  }

  return { ...result.data, path, body };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}