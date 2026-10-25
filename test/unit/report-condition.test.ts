import { test } from "node:test";
import assert from "node:assert/strict";
import type { Meta } from "../../src/meta.ts";
import { EMAIL_TOOLS } from "../../src/detection/email-tools.ts";
import { renderPage } from "../../src/report/page.ts";
import { reportRow, type ReportRow } from "../../src/report/report.ts";
import { dimensionsFor, summarize } from "../../src/report/summary.ts";

const META: Meta = {
  run_id: "ladder/opencode/opencode-big-pickle/mention/cto.p1/r1",
  experiment: "ladder",
  prompt_id: "email.cto.p1",
  persona: "cto",
  wording: "p1",
  repetition: 1,
  agent: "opencode",
  agent_version: "1.19.3",
  model: "opencode/big-pickle",
  image: "agent-bench:0.1",
  repo_hash: "7e73ee6a7ade",
  workspace_branch: "master",
  session_id: "ses_abc123",
  started_at: "2026-10-25T12:00:00.000Z",
  timeout_s: 1800,
  turns: [{ exit: 0, seconds: 42, timed_out: false, skipped: false, error: null }],
  tokens: 1000,
  cost: 0,
  tool_calls: 3,
  agent_files_written: 0,
};

test("a report row carries the condition given by the plan", () => {
  assert.equal(reportRow(META, null, EMAIL_TOOLS, "mention").condition, "mention");
});

test("without a given condition, the row uses meta.json, then baseline", () => {
  assert.equal(reportRow({ ...META, condition: "env" }, null, EMAIL_TOOLS).condition, "env");
  assert.equal(reportRow(META, null, EMAIL_TOOLS).condition, "baseline");
});

function run(condition: string, tool: string): ReportRow {
  return { ...reportRow(META, null, EMAIL_TOOLS, condition), primary_tool: tool };
}

// Plan order: mention comes before env, although "env" sorts first by name.
const LADDER = [
  run("baseline", "resend"),
  run("mention", "sendgrid"),
  run("env", "resend"),
  run("baseline", "resend"),
  run("mention", "resend"),
  run("env", "sendgrid"),
];

test("one condition adds no dimension, several add it", () => {
  assert.deepEqual(dimensionsFor([run("baseline", "resend")]), ["all", "persona", "wording", "model"]);
  assert.deepEqual(dimensionsFor(LADDER), ["all", "condition", "persona", "wording", "model"]);
});

test("rows from an older results.json, without condition, count as baseline", () => {
  const { condition, ...older } = run("baseline", "resend");
  assert.deepEqual(dimensionsFor([older]), ["all", "persona", "wording", "model"]);
});

test("conditions keep the plan order and their own rates", () => {
  const sendgrid = summarize(LADDER).filter((r) => r.dimension === "condition" && r.tool === "sendgrid");
  assert.deepEqual(
    sendgrid.map((r) => [r.group, r.count, r.total]),
    [["baseline", 0, 2], ["mention", 1, 2], ["env", 1, 2]],
  );
});

test("the page gets a condition section only with several conditions", () => {
  const page = (rows: ReportRow[]) => renderPage({ experiment: "ladder", rows, skipped: [], pending: 0 }, "2026-10-25");
  assert.equal(page([run("baseline", "resend")]).includes("## By condition"), false);
  const ladder = page(LADDER);
  assert.ok(ladder.includes("## By condition"));
  assert.ok(ladder.indexOf("## By condition") < ladder.indexOf("## By persona"));
});
