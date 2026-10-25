/**
 * Overlay of a condition: a directory whose files are copied over the
 * extracted repo before the workspace's initial commit.
 *
 * The agent then sees the variant as the original state of the repo:
 * one neutral commit, and nothing of the overlay in diff.patch.
 * Files are replaced whole; an overlay cannot delete a file.
 */
import { createHash } from "node:crypto";
import { cp, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { ConfigError } from "./config.ts";

/** Files of the overlay, relative to it, with "/" separators, sorted. */
export async function listOverlay(dir: string): Promise<string[]> {
  let isDirectory: boolean;
  try {
    isDirectory = (await stat(dir)).isDirectory();
  } catch {
    throw new ConfigError(`overlay ${dir} does not exist`);
  }
  if (!isDirectory) throw new ConfigError(`overlay ${dir} is not a directory`);

  const files = await walk(dir, "");
  if (files.length === 0) throw new ConfigError(`overlay ${dir} has no files`);
  return files.sort();
}

/** Copies the overlay into dest, replacing files with the same path. */
export async function applyOverlay(dir: string, dest: string): Promise<string[]> {
  const files = await listOverlay(dir);
  await cp(dir, dest, { recursive: true, force: true });
  return files;
}
/**
 * 12-char sha256 of the overlay's paths and contents (like repo_hash).
 * Recorded in meta.json and frozen: editing a fixture mid-experiment is
 * caught on resume instead of mixing two variants.
 */
export async function hashOverlay(dir: string): Promise<string> {
  const hash = createHash("sha256");
  for (const file of await listOverlay(dir)) {
    const content = await readFile(join(dir, file));
    hash.update(`${file}\0${content.length}\0`);
    hash.update(content);
  }
  return hash.digest("hex").slice(0, 12);
}


// Symlinks and other special files are refused: the copy must be the
// same on every machine, and hashOverlay only reads files.
async function walk(root: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await walk(root, path)));
    else if (entry.isFile()) files.push(path);
    else throw new ConfigError(`overlay ${root}: ${path} is not a regular file`);
  }
  return files;
}
