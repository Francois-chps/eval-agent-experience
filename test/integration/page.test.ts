import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExperiment } from "../../src/config.ts";
import type { Meta } from "../../src/meta.ts";
import { buildPlan } from "../../src/plan.ts";
import { publishPage } from "../../src/report/publish.ts";
import { reportExperiment } from "../../src/report/report.ts";

const CONFIG = "experiments/email-full.yaml";
const NOW = new Date("2026-10-23T12:00:00Z");

function meta(runId: string): Meta {
  return {
    run_id: runId,
    experiment: "email-full",
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
    session_id: "ses_test",
    started_at: "2026-10-21T08:53:21.598Z",
    timeout_s: 1800,
    turns: [{ exit: 0, seconds: 1, timed_out: false, skipped: false, error: null }],
    tokens: 1,
    cost: 0,
    tool_calls: 1,
    agent_files_written: 0,
  };
}

test("page is generated from the results.json written by report", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "page-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  const runs = join(root, "runs");
  const results = join(root, "results");

  const [first] = buildPlan(await loadExperiment(CONFIG));
  assert.ok(first, "the plan has no run");
  const dir = join(runs, first.id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "meta.json"), JSON.stringify(meta(first.id)));
  await writeFile(
    join(dir, "diff.patch"),
    ["--- /dev/null", "+++ b/lib/email.ts", "@@ -0,0 +1,1 @@", '+const URL = "https://api.resend.com/emails";'].join("\n"),
  );

  assert.equal(await reportExperiment(CONFIG, runs), 0);
  assert.equal(await publishPage(CONFIG, runs, results, NOW), 0);

  const page = await readFile(join(results, "email-full.md"), "utf8");
  assert.ok(page.startsWith("# Results: email-full\n"), page);
  assert.ok(page.includes("on 2026-10-23."), page);
  assert.ok(page.includes("- Runs: 1 finished (0 timed out), 0 skipped, 29 not run yet"), page);
  assert.ok(page.includes("| 1 | resend | 1/1 | 100% | 21-100% |"), page);
});

test("page without results.json fails and writes nothing", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "page-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const error = t.mock.method(console, "error", () => {});
  const results = join(root, "results");

  assert.equal(await publishPage(CONFIG, join(root, "runs"), results, NOW), 1);
  assert.match(String(error.mock.calls[0]?.arguments[0]), /run bench report first/);
  await assert.rejects(readFile(join(results, "email-full.md")));
});
