import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigError } from "../src/config.ts";
import { loadPrompt } from "../src/prompt.ts";

const GOOD = `---
id: email.cto.p1
category: email
persona: cto
wording: p1
---
Send a welcome email.
`;

async function write(name: string, text: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "prompt-"));
  const path = join(dir, name);
  await writeFile(path, text);
  return path;
}

test("reads front-matter and body", async () => {
  const p = await loadPrompt(await write("cto.p1.md", GOOD));
  assert.equal(p.id, "email.cto.p1");
  assert.equal(p.persona, "cto");
  assert.equal(p.wording, "p1");
  assert.equal(p.body, "Send a welcome email.");
});

test("accepts Windows line endings", async () => {
  const p = await loadPrompt(await write("cto.p1.md", GOOD.replace(/\n/g, "\r\n")));
  assert.equal(p.body, "Send a welcome email.");
});

test("rejects an id that does not match the fields", async () => {
  const path = await write("ceo.p1.md", GOOD.replace("persona: cto", "persona: ceo"));
  await assert.rejects(loadPrompt(path), ConfigError);
});

test("rejects a file name that does not match", async () => {
  await assert.rejects(loadPrompt(await write("cto.p9.md", GOOD)), ConfigError);
});

test("rejects a missing front-matter", async () => {
  await assert.rejects(loadPrompt(await write("cto.p1.md", "Just text\n")), ConfigError);
});

test("rejects an unknown front-matter key", async () => {
  const path = await write("cto.p1.md", GOOD.replace("wording: p1", "wording: p1\nmodel: x"));
  await assert.rejects(loadPrompt(path), ConfigError);
});

test("rejects an empty body", async () => {
  const path = await write("cto.p1.md", GOOD.replace("Send a welcome email.\n", ""));
  await assert.rejects(loadPrompt(path), ConfigError);
});

test("all email prompts of the repo are valid", async () => {
  const files = (await readdir("prompts/email")).filter((f) => f.endsWith(".md"));
  assert.equal(files.length, 6);
  for (const file of files) {
    await loadPrompt(join("prompts/email", file));
  }
});
