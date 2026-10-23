import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExperiment } from "../../src/config.ts";
import type { Meta } from "../../src/meta.ts";
import { buildPlan } from "../../src/plan.ts";
import { reportExperiment } from "../../src/report/report.ts";

const CONFIG = "experiments/email-full.yaml";

function meta(runId: string, timedOut = false): Meta {
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
    turns: [{ exit: timedOut ? null : 0, seconds: 1, timed_out: timedOut, skipped: false, error: null }],
    tokens: 1,
    cost: 0,
    tool_calls: 1,
    agent_files_written: 0,
  };
}

function newFile(path: string, lines: readonly string[]): string {
  return [`--- /dev/null`, `+++ b/${path}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
}

async function fakeRun(root: string, runId: string, files: Record<string, string>): Promise<void> {
  const dir = join(root, runId);
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content);
}

async function planIds(): Promise<(index: number) => string> {
  const ids = buildPlan(await loadExperiment(CONFIG)).map((run) => run.id);
  return (index) => {
    const id = ids[index];
    assert.ok(id, `the plan has no run ${index}`);
    return id;
  };
}

test("report covers finished runs only and writes CSV, JSON and summary", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "report-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const id = await planIds();
  const resendDiff = newFile("lib/email.ts", ['const URL = "https://api.resend.com/emails";']);
  const fallbackDiff = `${resendDiff}\n${newFile("package.json", ['    "nodemailer": "^10.1.7",'])}`;
  await fakeRun(root, id(0), { "meta.json": JSON.stringify(meta(id(0))), "diff.patch": resendDiff });
  await fakeRun(root, id(1), { "meta.json": JSON.stringify(meta(id(1), true)), "diff.patch": fallbackDiff });
  await fakeRun(root, id(2), { "meta.json": JSON.stringify(meta(id(2))) });
  await fakeRun(root, id(3), { "meta.json": "{}" });

  const log = t.mock.method(console, "log", () => {});
  assert.equal(await reportExperiment(CONFIG, root), 0);

  const csv = (await readFile(join(root, "email-full", "results.csv"), "utf8")).trim().split("\n");
  assert.equal(csv.length, 4);
  assert.equal(csv[0], "run_id,persona,wording,model,repetition,timed_out,has_diff,verdict,tools,primary_tool");
  assert.ok(csv[1]?.endsWith(",false,true,single,resend,resend"), csv[1]);
  assert.ok(csv[2]?.endsWith(',true,true,multiple,"resend,smtp",smtp'), csv[2]);
  assert.ok(csv[3]?.endsWith(",false,false,none,,none"), csv[3]);

  const json = JSON.parse(await readFile(join(root, "email-full", "results.json"), "utf8"));
  assert.equal(json.rows.length, 3);
  assert.ok(json.rows[1].evidence.length >= 2);
  assert.deepEqual(json.skipped.map((item: { run_id: string }) => item.run_id), [id(3)]);
  assert.equal(json.pending, 26);

  const summary = (await readFile(join(root, "email-full", "summary.csv"), "utf8")).trim().split("\n");
  // 4 groups (all, cto, p1, big-pickle) x 3 tools (none, resend, smtp), plus the header.
  assert.equal(summary.length, 13);
  assert.equal(summary[0], "dimension,group,tool,count,total,rate,lower,upper,timed_out");
  assert.match(summary[1] ?? "", /^all,all,none,1,3,0\.3333,0\.06\d*,0\.79\d*,1$/);
  assert.match(summary[2] ?? "", /^all,all,resend,1,3,0\.3333,0\.06\d*,0\.79\d*,1$/);
  assert.ok(summary.some((line) => line.startsWith("persona,cto,smtp,1,3,")));

  const printed = log.mock.calls.map((call) => call.arguments.join(" ")).join("\n");
  assert.ok(printed.includes("resend "), printed);
  assert.ok(printed.includes("    1/3  33.3%  [  6.1%,  79.2%]"), printed);
  assert.ok(printed.includes("timed out: 1, no diff.patch: 1"), printed);

  assert.match(printed, /timed out: 1, no diff\.patch: 1/);
});

test("report with no finished run fails and writes nothing", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "report-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.equal(await reportExperiment(CONFIG, root), 1);
  await assert.rejects(readFile(join(root, "email-full", "results.csv")));
  await assert.rejects(readFile(join(root, "email-full", "summary.csv")));
});
