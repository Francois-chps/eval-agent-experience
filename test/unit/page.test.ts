import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPage } from "../../src/report/page.ts";
import type { Report, ReportRow } from "../../src/report/report.ts";

function row(persona: string, primary: string, timedOut = false): ReportRow {
  return {
    run_id: `run-${persona}-${primary}`,
    condition: "baseline",
    persona,
    wording: "p1",
    model: "opencode/big-pickle",
    repetition: 1,
    timed_out: timedOut,
    has_diff: true,
    verdict: primary === "none" ? "none" : "single",
    tools: primary === "none" ? [] : [primary],
    primary_tool: primary,
    evidence: [],
  };
}

const REPORT: Report = {
  experiment: "email-full",
  rows: [
    row("cto", "resend"),
    row("cto", "resend"),
    row("cto", "smtp"),
    row("dev", "resend"),
    row("dev", "none", true),
  ],
  skipped: [],
  pending: 25,
};

const page = renderPage(REPORT, "2026-10-23");

test("header gives the experiment, model and run counts", () => {
  assert.ok(page.startsWith("# Results: email-full\n"), page);
  assert.ok(page.includes("on 2026-10-23."), page);
  assert.ok(page.includes("- Model: `opencode/big-pickle`"), page);
  assert.ok(page.includes("- Runs: 5 finished (1 timed out), 0 skipped, 25 not run yet"), page);
});

test("leaderboard ranks tools by rate and ties share a rank", () => {
  const first = page.indexOf("| 1 | resend | 3/5 | 60% | 23-88% |");
  const none = page.indexOf("| 2 | none | 1/5 | 20% | 4-62% |");
  const smtp = page.indexOf("| 2 | smtp | 1/5 | 20% | 4-62% |");
  assert.ok(first > 0 && none > first && smtp > none, page);
});

test("dimension tables list every tool in every group, with timeouts", () => {
  assert.ok(page.includes("## By persona\n\n| Tool | cto | dev |\n| --- | ---: | ---: |"), page);
  assert.ok(page.includes("| smtp | 1/3 (6-79%) | 0/2 (0-66%) |"), page);
  assert.ok(page.includes("| *timed out* | 0 | 1 |"), page);
  assert.ok(page.includes("## By wording"), page);
  assert.ok(page.includes("## By model"), page);
});

test("page links to the report docs and ends with a newline", () => {
  assert.ok(page.includes("[docs/report.md](../docs/report.md)"), page);
  assert.ok(page.endsWith(".\n"), page);
});

test("pipes in values do not break the tables", () => {
  const piped = renderPage({ ...REPORT, rows: [row("a|b", "resend")] }, "2026-10-23");
  assert.ok(piped.includes("| Tool | a&#124;b |"), piped);
});

test("a report without finished runs is rejected", () => {
  assert.throws(() => renderPage({ ...REPORT, rows: [] }, "2026-10-23"), RangeError);
});
