/**
 * Choice rates per primary tool, overall and per persona, wording and model,
 * each with a 95% Wilson interval.
 *
 * Every tool seen in the experiment is listed in every group, including with a
 * count of 0: "0/10 for cto" with its upper bound is a result too.
 * "ambiguous" and "none" are categories like any tool, so rates in a group sum to 1.
 */
import { wilson } from "../stats/wilson.ts";
import type { ReportRow } from "./report.ts";

export const DIMENSIONS = ["all", "persona", "wording", "model"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export type SummaryInput = Pick<ReportRow, "persona" | "wording" | "model" | "primary_tool" | "timed_out">;

export interface SummaryRow {
  dimension: Dimension;
  /** Value of the dimension, e.g. "cto"; "all" for the whole experiment. */
  group: string;
  tool: string;
  count: number;
  /** Runs in the group. */
  total: number;
  rate: number;
  lower: number;
  upper: number;
  /** Timed-out runs in the group: counted, but shown so the reader can judge. */
  timed_out: number;
}

function groupOf(row: SummaryInput, dimension: Dimension): string {
  return dimension === "all" ? "all" : row[dimension];
}

/** Tools by overall count, most chosen first; ties by name, so the order is stable. */
function toolsByCount(rows: readonly SummaryInput[]): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.primary_tool, (counts.get(row.primary_tool) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
}

export function summarize(
  rows: readonly SummaryInput[],
  dimensions: readonly Dimension[] = DIMENSIONS,
): SummaryRow[] {
  const tools = toolsByCount(rows);
  const summary: SummaryRow[] = [];
  for (const dimension of dimensions) {
    const groups = new Map<string, SummaryInput[]>();
    for (const row of rows) {
      const key = groupOf(row, dimension);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    for (const group of [...groups.keys()].sort()) {
      const members = groups.get(group) ?? [];
      const timedOut = members.filter((row) => row.timed_out).length;
      for (const tool of tools) {
        const count = members.filter((row) => row.primary_tool === tool).length;
        const { rate, lower, upper } = wilson(count, members.length);
        summary.push({ dimension, group, tool, count, total: members.length, rate, lower, upper, timed_out: timedOut });
      }
    }
  }
  return summary;
}
