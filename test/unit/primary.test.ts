import { test } from "node:test";
import assert from "node:assert/strict";
import type { Detection, SignalKind } from "../../src/detection/detect.js";
import { AMBIGUOUS, NO_TOOL, primaryTool } from "../../src/detection/primary.js";

function detection(...items: ReadonlyArray<readonly [string, SignalKind]>): Detection {
  const evidence = items.map(([tool, kind], index) => ({ file: "lib/email.ts", line: index + 1, text: "", tool, kind }));
  const tools = [...new Set(items.map(([tool]) => tool))];
  const verdict = tools.length === 0 ? "none" : tools.length === 1 ? "single" : "multiple";
  return { tools, verdict, evidence };
}

test("no evidence gives none", () => {
  assert.equal(primaryTool(detection()), NO_TOOL);
});

test("a single tool is the primary tool", () => {
  assert.equal(primaryTool(detection(["resend", "host"], ["resend", "env"])), "resend");
});

test("an API host beats env vars of another tool", () => {
  assert.equal(primaryTool(detection(["resend", "host"], ["smtp", "env"])), "resend");
});

test("a dependency beats an API host", () => {
  assert.equal(primaryTool(detection(["resend", "host"], ["resend", "env"], ["smtp", "dependency"])), "smtp");
});

test("strength counts, not the amount of evidence", () => {
  const manyEnv = Array.from({ length: 5 }, () => ["smtp", "env"] as const);
  assert.equal(primaryTool(detection(...manyEnv, ["resend", "host"])), "resend");
});

test("a tie on the strongest evidence is ambiguous", () => {
  assert.equal(primaryTool(detection(["resend", "import"], ["smtp", "dependency"])), AMBIGUOUS);
  assert.equal(primaryTool(detection(["resend", "env"], ["smtp", "env"])), AMBIGUOUS);
});
