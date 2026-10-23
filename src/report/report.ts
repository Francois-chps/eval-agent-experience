/**
 * bench report: applies the detector to every finished run of an experiment
 * and writes results.csv and results.json next to the runs.
 *
 * Runs come from the plan, not from a directory walk, so only the runs the
 * config describes are reported, at the same path `run` writes them.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadExperiment } from "../config.ts";
import { detectTools, type Evidence, type Verdict } from "../detection/detect.ts";
import { primaryTool } from "../detection/primary.ts";
import { readMeta, type Meta } from "../meta.ts";
import { buildPlan } from "../plan.ts";
import { RUNS_ROOT } from "../run.ts";
import { toCsv } from "./csv.ts";

export interface ReportRow {
  run_id: string;
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

/** The diff of a run, or null when the run has no diff.patch. */
async function readDiff(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export function reportRow(meta: Meta, diff: string | null): ReportRow {
  const detection = detectTools(diff ?? "");
  return {
    run_id: meta.run_id,
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
  const report: Report = { experiment: experiment.id, rows: [], skipped: [], pending: 0 };
  for (const spec of buildPlan(experiment)) {
    const runDir = join(runsRoot, spec.id);
    const read = await readMeta(join(runDir, "meta.json"));
    if (read.status === "missing") {
      report.pending += 1;
    } else if (read.status === "invalid") {
      report.skipped.push({ run_id: spec.id, reason: read.reason });
    } else {
      report.rows.push(reportRow(read.meta, await readDiff(join(runDir, "diff.patch"))));
    }
  }
  return report;
}

/** Writes results.csv and results.json and prints a summary. Exit code 1 when no run is finished. */
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
  await mkdir(outDir, { recursive: true });
  const csvRows = report.rows.map((row) => [
    row.run_id,
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

  const counts = new Map<string, number>();
  for (const row of report.rows) counts.set(row.primary_tool, (counts.get(row.primary_tool) ?? 0) + 1);
  console.log("primary tool:");
  for (const [tool, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tool.padEnd(12)} ${count}`);
  }
  const timedOut = report.rows.filter((row) => row.timed_out).length;
  const noDiff = report.rows.filter((row) => !row.has_diff).length;
  console.log(`timed out: ${timedOut}, no diff.patch: ${noDiff}`);
  console.error(`wrote ${csvPath} and ${jsonPath}`);
  return 0;
}
