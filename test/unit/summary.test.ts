import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, type SummaryInput, type SummaryRow } from "../../src/report/summary.ts";

function row(persona: string, wording: string, primary_tool: string, timed_out = false): SummaryInput {
  return { persona, wording, model: "opencode/big-pickle", primary_tool, timed_out };
}

const ROWS: readonly SummaryInput[] = [
  row("cto", "p1", "resend"),
  row("cto", "p2", "resend"),
  row("cto", "p1", "smtp"),
  row("junior", "p1", "resend"),
  row("junior", "p2", "none", true),
];

function find(summary: readonly SummaryRow[], group: string, tool: string): SummaryRow {
  const found = summary.find((item) => item.group === group && item.tool === tool);
  assert.ok(found, `no row for ${group} / ${tool}`);
  return found;
}

test("the overall group lists tools by count, ties by name", () => {
  const overall = summarize(ROWS, ["all"]);
  assert.deepEqual(overall.map((item) => item.tool), ["resend", "none", "smtp"]);
  assert.deepEqual(
    overall.map((item) => [item.count, item.total]),
    [[3, 5], [1, 5], [1, 5]],
  );
});

test("rates in each group sum to 1", () => {
  const summary = summarize(ROWS);
  const sums = new Map<string, number>();
  for (const item of summary) {
    const key = `${item.dimension}/${item.group}`;
    sums.set(key, (sums.get(key) ?? 0) + item.rate);
  }
  assert.deepEqual([...sums.keys()], ["all/all", "persona/cto", "persona/junior", "wording/p1", "wording/p2", "model/opencode/big-pickle"]);
  for (const [key, sum] of sums) assert.ok(Math.abs(sum - 1) < 1e-9, `${key} sums to ${sum}`);
});

test("a tool never chosen in a group is listed with a non-zero upper bound", () => {
  const smtp = find(summarize(ROWS, ["persona"]), "junior", "smtp");
  assert.equal(smtp.count, 0);
  assert.equal(smtp.total, 2);
  assert.ok(smtp.upper > 0);
});

test("each row carries the interval of its rate", () => {
  const resend = find(summarize(ROWS, ["persona"]), "cto", "resend");
  assert.ok(Math.abs(resend.rate - 2 / 3) < 1e-9);
  assert.ok(resend.lower < resend.rate && resend.rate < resend.upper);
});

test("timed-out runs are counted per group", () => {
  const summary = summarize(ROWS);
  assert.equal(find(summary, "all", "resend").timed_out, 1);
  assert.equal(find(summary, "cto", "resend").timed_out, 0);
  assert.equal(find(summary, "junior", "resend").timed_out, 1);
});

test("no rows give no summary", () => {
  assert.deepEqual(summarize([]), []);
});
