/**
 * bench report: applies the detector to every finished run of an experiment
 * and writes results.csv, results.json and summary.csv next to the runs.
 *
 * Runs come from the plan, not from a directory walk, so only the runs the
 * config describes are reported, at the same path `run` writes them.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadExperiment } from "../config.ts";
import { catalogFor, type Catalog } from "../detection/catalogs.ts";
import { detectTools, type Evidence, type Verdict } from "../detection/detect.ts";
import { primaryTool } from "../detection/primary.ts";
import { readMeta, type Meta } from "../meta.ts";
import { BASELINE, buildPlan } from "../plan.ts";
import { RUNS_ROOT } from "../run.ts";
import { toCsv } from "./csv.ts";
import { dimensionsFor, summarize, type SummaryRow } from "./summary.ts";

export interface ReportRow {
  run_id: string;
    /** Condition of the run ("baseline" when the experiment declares none). */
  condition: string;
  persona: string;
  wording: string;
  model: string;
  repetition: number;
  /** At least one turn hit the timeout: the change may be unfinished. */
  timed_out: boolean;
  has_diff: boolean;
  verdict: Verdict;
  tools: readonly string[];
  primary_tool: string;
  evidence: readonly Evidence[];
}

export interface Report {
  experiment: string;
  rows: ReportRow[];
  /** Runs whose meta.json is invalid: listed, never counted. */
  skipped: { run_id: string; reason: string }[];
  /** Planned runs with no meta.json yet. */
  pending: number;
}

const CSV_HEADER = [
  "run_id",
  "condition",
  "persona",
  "wording",
  "model",
  "repetition",
  "timed_out",
  "has_diff",
  "verdict",
  "tools",
  "primary_tool",
] as const;

const SUMMARY_HEADER = [
  "dimension",
  "group",
  "tool",
  "count",
  "total",
  "rate",
  "lower",
  "upper",
  "timed_out",
] as const;

/** Four decimals: precise enough for a rate, short enough to read the CSV. */
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** 0.0615 -> "  6.1%", padded so the columns line up. */
function percent(value: number): string {
  return `${(value * 100).toFixed(1).padStart(5)}%`;
}
/** One line per tool chosen at least once, with its 95% Wilson interval. */
function printRates(title: string, rows: readonly SummaryRow[]): void {
  console.log(title);
  for (const row of rows) {
    if (row.count === 0) continue;
    const share = `${row.count}/${row.total}`;
    console.log(
      `  ${row.tool.padEnd(12)} ${share.padStart(7)} ${percent(row.rate)}  [${percent(row.lower)}, ${percent(row.upper)}]`,
    );
  }
}

/** The diff of a run, or null when the run has no diff.patch. */
async function readDiff(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

/**
 * The condition comes from the plan (buildReport): runs recorded before
 * conditions existed have none in meta.json but are baseline runs.
 * The catalog is the one of the experiment's category.
 */
export function reportRow(
  meta: Meta,
  diff: string | null,
  catalog: Catalog,
  condition: string = meta.condition ?? BASELINE,
): ReportRow {
  const detection = detectTools(diff ?? "", catalog);
  return {
    run_id: meta.run_id,
    condition,
    persona: meta.persona,
    wording: meta.wording,
    model: meta.model,
    repetition: meta.repetition,
    timed_out: meta.turns.some((turn) => turn.timed_out),
    has_diff: diff !== null,
    verdict: detection.verdict,
    tools: detection.tools,
    primary_tool: primaryTool(detection),
    evidence: detection.evidence,
  };
}

export async function buildReport(configPath: string, runsRoot: string = RUNS_ROOT): Promise<Report> {
  const experiment = await loadExperiment(configPath);
  const catalog = catalogFor(experiment.category);
  const report: Report = { experiment: experiment.id, rows: [], skipped: [], pending: 0 };
  for (const spec of buildPlan(experiment)) {
    const runDir = join(runsRoot, spec.id);
    const read = await readMeta(join(runDir, "meta.json"));
    if (read.status === "missing") {
      report.pending += 1;
    } else if (read.status === "invalid") {
      report.skipped.push({ run_id: spec.id, reason: read.reason });
    } else {
            const diff = await readDiff(join(runDir, "diff.patch"));
            report.rows.push(reportRow(read.meta, diff, catalog, spec.condition));

    }
  }
  return report;
}

/**
 * Writes results.csv, results.json and summary.csv, and prints the overall
 * choice rates with their 95% Wilson interval. Exit code 1 when no run is finished.
 */
export async function reportExperiment(configPath: string, runsRoot: string = RUNS_ROOT): Promise<number> {
  const report = await buildReport(configPath, runsRoot);
  for (const { run_id, reason } of report.skipped) {
    console.error(`skipped ${run_id}: invalid meta.json\n  ${reason}`);
  }
  console.error(
    `${report.rows.length} finished, ${report.skipped.length} skipped, ${report.pending} not run yet`,
  );
  if (report.rows.length === 0) {
    console.error("bench: no finished run to report");
    return 1;
  }

  const outDir = join(runsRoot, report.experiment);
  const csvPath = join(outDir, "results.csv");
  const jsonPath = join(outDir, "results.json");
  const summaryPath = join(outDir, "summary.csv");
  await mkdir(outDir, { recursive: true });
  const csvRows = report.rows.map((row) => [
    row.run_id,
    row.condition,
    row.persona,
    row.wording,
    row.model,
    row.repetition,
    row.timed_out,
    row.has_diff,
    row.verdict,
    row.tools.join(","),
    row.primary_tool,
  ]);
  await writeFile(csvPath, toCsv(CSV_HEADER, csvRows));
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const dimensions = dimensionsFor(report.rows);
  const summary = summarize(report.rows, dimensions);
  const summaryRows = summary.map((row) => [
    row.dimension,
    row.group,
    row.tool,
    row.count,
    row.total,
    round(row.rate),
    round(row.lower),
    round(row.upper),
    row.timed_out,
  ]);
  await writeFile(summaryPath, toCsv(SUMMARY_HEADER, summaryRows));

  // Tools are already sorted by overall count, so by rate in the "all" group.
  printRates("primary tool, all runs (95% Wilson interval):", summary.filter((row) => row.dimension === "all"));
  const byCondition = summary.filter((row) => row.dimension === "condition");
  for (const group of new Set(byCondition.map((row) => row.group))) {
    printRates(`condition ${group}:`, byCondition.filter((row) => row.group === group));
  }
  const timedOut = report.rows.filter((row) => row.timed_out).length;
  const noDiff = report.rows.filter((row) => !row.has_diff).length;
  console.log(`timed out: ${timedOut}, no diff.patch: ${noDiff}`);
  console.log(`by ${dimensions.filter((d) => d !== "all").join(", ")}: ${summaryPath}`);

  console.error(`wrote ${csvPath}, ${jsonPath} and ${summaryPath}`);
  return 0;
}
