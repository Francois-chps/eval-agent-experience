/**
 * bench page: reads tmp/runs/<experiment>/results.json, written by bench report,
 * and writes the Markdown results page to results/<experiment>.md.
 *
 * results/ is versioned, unlike tmp/: the page is what gets published.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadExperiment } from "../config.ts";
import { RUNS_ROOT } from "../run.ts";
import { renderPage } from "./page.ts";
import type { Report } from "./report.ts";

export const RESULTS_ROOT = "results";

/** Writes results/<experiment>.md. Exit code 1 when results.json is missing or has no finished run. */
export async function publishPage(
  configPath: string,
  runsRoot: string = RUNS_ROOT,
  resultsRoot: string = RESULTS_ROOT,
  now: Date = new Date(),
): Promise<number> {
  const experiment = await loadExperiment(configPath);
  const jsonPath = join(runsRoot, experiment.id, "results.json");
  let report: Report;
  try {
    report = JSON.parse(await readFile(jsonPath, "utf8")) as Report;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.error(`bench: ${jsonPath} not found, run bench report first`);
      return 1;
    }
    throw error;
  }
  if (report.rows.length === 0) {
    console.error(`bench: no finished run in ${jsonPath}`);
    return 1;
  }

  const pagePath = join(resultsRoot, `${experiment.id}.md`);
  await mkdir(resultsRoot, { recursive: true });
  await writeFile(pagePath, renderPage(report, now.toISOString().slice(0, 10)));
  console.error(`wrote ${pagePath}`);
  return 0;
}
