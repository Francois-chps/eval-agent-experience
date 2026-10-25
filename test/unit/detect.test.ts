import { test } from "node:test";
import assert from "node:assert/strict";
import { addedLines, detectTools } from "../../src/detection/detect.js";
import { EMAIL_TOOLS } from "../../src/detection/email-tools.js";

function newFile(path: string, lines: readonly string[]): string {
  return [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join("\n");
}

function tools(...diffs: string[]): readonly string[] {
  return detectTools(diffs.join("\n"), EMAIL_TOOLS).tools;
}

test("addedLines keeps added lines with their new line numbers", () => {
  const diff = [
    "diff --git a/lib/a.ts b/lib/a.ts",
    "--- a/lib/a.ts",
    "+++ b/lib/a.ts",
    "@@ -10,3 +10,3 @@",
    " keep",
    "-old",
    "+new",
    " keep",
  ].join("\n");
  assert.deepEqual(addedLines(diff), [{ file: "lib/a.ts", line: 11, text: "new" }]);
});

test("addedLines reads an added line starting with ++ as content", () => {
  assert.deepEqual(addedLines(newFile("a.ts", ["++ not a header", "x"])), [
    { file: "a.ts", line: 1, text: "++ not a header" },
    { file: "a.ts", line: 2, text: "x" },
  ]);
});

test("addedLines ignores deleted files", () => {
  const diff = ["--- a/old.ts", "+++ /dev/null", "@@ -1,1 +0,0 @@", '-import { Resend } from "resend";'];
  assert.deepEqual(addedLines(diff.join("\n")), []);
});

test("a dependency added to package.json is detected", () => {
  const result = detectTools(newFile("package.json", ['    "nodemailer": "^10.1.7",']), EMAIL_TOOLS);
  assert.equal(result.verdict, "single");
  assert.deepEqual(result.tools, ["smtp"]);
  assert.equal(result.evidence[0]?.kind, "dependency");
});

test("imports are detected with from, require and dynamic import", () => {
  assert.deepEqual(tools(newFile("lib/a.ts", ['import nodemailer from "nodemailer";'])), ["smtp"]);
  assert.deepEqual(tools(newFile("lib/b.ts", ["const sg = require('@sendgrid/mail');"])), ["sendgrid"]);
  assert.deepEqual(tools(newFile("lib/c.ts", ['const { Resend } = await import("resend");'])), ["resend"]);
});

test("an API called with fetch and no SDK is detected from its host and env var", () => {
  const result = detectTools(
    newFile("lib/email.ts", ['const RESEND_API_URL = "https://api.resend.com/emails";']),
    EMAIL_TOOLS,
  );
  assert.deepEqual(result.tools, ["resend"]);
  assert.deepEqual(result.evidence.map((item) => item.kind), ["host", "env"]);
});

test("environment variables are detected", () => {
  assert.deepEqual(tools(newFile(".env.example", ["SMTP_HOST=smtp.example.com", "SMTP_PORT=587"])), ["smtp"]);
});

test("several tools give a multiple verdict, in catalog order", () => {
  const result = detectTools(
    [newFile(".env.example", ["SMTP_HOST=smtp.example.com"]), newFile("lib/email.ts", ['import { Resend } from "resend";'])].join("\n"),
    EMAIL_TOOLS,
  );
  assert.equal(result.verdict, "multiple");
  assert.deepEqual(result.tools, ["resend", "smtp"]);
});

test("a provider SMTP host counts for the provider", () => {
  assert.deepEqual(tools(newFile(".env.example", ["SMTP_HOST=smtp.resend.com"])), ["resend", "smtp"]);
});

test("no email signal gives a none verdict", () => {
  const result = detectTools(newFile("hello.py", ['print("hello")']), EMAIL_TOOLS);
  assert.equal(result.verdict, "none");
  assert.deepEqual(result.evidence, []);
});

test("mentions, class names and longer names are not signals", () => {
  const code = newFile("lib/email.ts", [
    'expect(() => loadEmailConfig({ EMAIL_TRANSPORT: "sendgrid" })).toThrow(EmailConfigError);',
    "export class SmtpTransport {}",
    "// Get a key at https://resend.com/api-keys",
    'import { x } from "resend-utils";',
    "const PRESEND_DELAY = 1;",
  ]);
  assert.deepEqual(tools(code, newFile("package.json", ['    "@types/nodemailer": "^8.0.2",'])), []);
});

test("lock files, Markdown and removed lines are ignored", () => {
  const removed = ["--- a/lib/old.ts", "+++ b/lib/old.ts", "@@ -1,1 +0,0 @@", '-import { Resend } from "resend";'];
  const lock = newFile("package-lock.json", ['    "nodemailer": "^10.1.7",']);
  const readme = newFile("README.md", ["Set RESEND_API_KEY in .env"]);
  assert.deepEqual(tools(lock, readme, removed.join("\n")), []);
});

test("the catalog has unique ids and at least one signal per tool", () => {
  const ids = EMAIL_TOOLS.map((tool) => tool.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const tool of EMAIL_TOOLS) {
    assert.ok(tool.packages.length + tool.hosts.length + tool.env.length > 0, tool.id);
  }
});
