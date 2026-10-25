import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ConfigError } from "../../src/config.ts";
import { applyOverlay, listOverlay } from "../../src/overlay.ts";

async function makeDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "overlay-"));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), content);
  }
  return dir;
}

test("lists nested files with slashes, sorted", async () => {
  const dir = await makeDir({ "src/lib/mail.ts": "x", "README.md": "x", ".env.example": "x" });
  assert.deepEqual(await listOverlay(dir), [".env.example", "README.md", "src/lib/mail.ts"]);
});

test("a missing overlay is a config error", async () => {
  await assert.rejects(listOverlay(join(tmpdir(), "no-such-overlay")), ConfigError);
});

test("an empty overlay is a config error", async () => {
  await assert.rejects(listOverlay(await makeDir({})), ConfigError);
});

test("an overlay with only empty folders is a config error", async () => {
  const dir = await makeDir({});
  await mkdir(join(dir, "src", "lib"), { recursive: true });
  await assert.rejects(listOverlay(dir), ConfigError);
});

test("an overlay that is a file is a config error", async () => {
  const dir = await makeDir({ "README.md": "x" });
  await assert.rejects(listOverlay(join(dir, "README.md")), ConfigError);
});

test("applying replaces files with the same path and keeps the others", async () => {
  const dest = await makeDir({ "README.md": "old", "package.json": "{}" });
  const overlay = await makeDir({ "README.md": "new" });
  assert.deepEqual(await applyOverlay(overlay, dest), ["README.md"]);
  assert.equal(await readFile(join(dest, "README.md"), "utf8"), "new");
  assert.equal(await readFile(join(dest, "package.json"), "utf8"), "{}");
});
