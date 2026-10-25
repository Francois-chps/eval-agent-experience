import { test } from "node:test";
import assert from "node:assert/strict";
import type { Meta } from "../../src/meta.ts";
import { reportRow } from "../../src/report/report.ts";

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
  assert.equal(reportRow(META, null, "mention").condition, "mention");
});

test("without a given condition, the row uses meta.json, then baseline", () => {
  assert.equal(reportRow({ ...META, condition: "env" }, null).condition, "env");
  assert.equal(reportRow(META, null).condition, "baseline");
});
