import type { Catalog } from "./catalogs.js";
import { escapeRegExp } from "./email-tools.js";

export type SignalKind = "dependency" | "import" | "host" | "env";
export type Verdict = "none" | "single" | "multiple";

export interface AddedLine {
  readonly file: string;
  /** Line number in the new version of the file. */
  readonly line: number;
  readonly text: string;
}

export interface Evidence extends AddedLine {
  readonly tool: string;
  readonly kind: SignalKind;
}

export interface Detection {
  /** Detected tool ids, in catalog order. */
  readonly tools: readonly string[];
  readonly verdict: Verdict;
  readonly evidence: readonly Evidence[];
}

interface Matcher {
  readonly tool: string;
  readonly kind: SignalKind;
  readonly pattern: RegExp;
}

const HUNK_HEADER = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const LOCKFILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
]);
const MAX_TEXT = 200;

function basename(file: string): string {
  return file.slice(file.lastIndexOf("/") + 1);
}

function targetPath(header: string): string | null {
  const path = header.split("\t")[0] ?? "";
  if (path === "/dev/null") return null;
  return path.startsWith("b/") ? path.slice(2) : path;
}

/**
 * Lines added by a unified diff (git diff format), with their file and line number.
 * Hunk sizes are tracked, so an added line starting with "++" is never read as a file header.
 */
export function addedLines(diff: string): AddedLine[] {
  const added: AddedLine[] = [];
  let file: string | null = null;
  let oldLeft = 0;
  let newLeft = 0;
  let line = 0;
  for (const raw of diff.split("\n")) {
    const text = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (oldLeft > 0 || newLeft > 0) {
      const marker = text.charAt(0);
      if (marker === "+") {
        if (file !== null) added.push({ file, line, text: text.slice(1) });
        line += 1;
        newLeft -= 1;
      } else if (marker === "-") {
        oldLeft -= 1;
      } else if (marker !== "\\") {
        line += 1;
        oldLeft -= 1;
        newLeft -= 1;
      }
      continue;
    }
    if (text.startsWith("+++ ")) {
      file = targetPath(text.slice(4));
      continue;
    }
    const hunk = HUNK_HEADER.exec(text);
    if (hunk !== null) {
      oldLeft = Number(hunk[1] ?? "1");
      line = Number(hunk[2]);
      newLeft = Number(hunk[3] ?? "1");
    }
  }
  return added;
}

/** Lock files list transitive dependencies; Markdown can mention alternatives the agent did not use. */
export function isIgnored(file: string): boolean {
  const name = basename(file);
  return LOCKFILES.has(name) || /\.mdx?$/i.test(name);
}

function matchersFor(tools: Catalog): Matcher[] {
  return tools.flatMap((tool): Matcher[] => [
    ...tool.packages.map((pkg): Matcher => ({
      tool: tool.id,
      kind: "dependency",
      pattern: new RegExp(`^\\s*"${escapeRegExp(pkg)}"\\s*:`),
    })),
    ...tool.packages.map((pkg): Matcher => ({
      tool: tool.id,
      kind: "import",
      pattern: new RegExp(
        `(?:\\bfrom\\s*|\\brequire\\s*\\(\\s*|\\bimport\\s*\\(?\\s*)["']${escapeRegExp(pkg)}(?:/[^"']*)?["']`,
      ),
    })),
    ...tool.hosts.map((pattern): Matcher => ({ tool: tool.id, kind: "host", pattern })),
    ...tool.env.map((pattern): Matcher => ({ tool: tool.id, kind: "env", pattern })),
  ]);
}

/**
 * Tools of a catalog used by the changes of a run, from the added lines of its diff only.
 * In package.json only dependencies count; in other files imports, API hosts and env vars count.
 */
export function detectTools(diff: string, tools: Catalog): Detection {
  const matchers = matchersFor(tools);
  const evidence: Evidence[] = [];
  for (const added of addedLines(diff)) {
    if (isIgnored(added.file)) continue;
    const manifest = basename(added.file) === "package.json";
    for (const { tool, kind, pattern } of matchers) {
      if ((kind === "dependency") !== manifest) continue;
      if (pattern.test(added.text)) {
        evidence.push({ ...added, text: added.text.trim().slice(0, MAX_TEXT), tool, kind });
      }
    }
  }
  const found = new Set(evidence.map((item) => item.tool));
  const ids = tools.map((tool) => tool.id).filter((id) => found.has(id));
  const verdict: Verdict = ids.length === 0 ? "none" : ids.length === 1 ? "single" : "multiple";
  return { tools: ids, verdict, evidence };
}
