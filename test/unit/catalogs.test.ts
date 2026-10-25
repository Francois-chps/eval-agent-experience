import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogFor, type Catalog } from "../../src/detection/catalogs.ts";
import { detectTools } from "../../src/detection/detect.ts";
import { EMAIL_TOOLS } from "../../src/detection/email-tools.ts";
import { loadExperiment } from "../../src/config.ts";
import { ExperimentSchema } from "../../src/schema.ts";

const pilot = await loadExperiment("experiments/email-pilot.yaml");

const AUTH: Catalog = [{ id: "clerk", name: "Clerk", packages: ["@clerk/nextjs"], hosts: [], env: [] }];

const DIFF = [
  "diff --git a/package.json b/package.json",
  "--- /dev/null",
  "+++ b/package.json",
  "@@ -0,0 +1,2 @@",
  '+  "resend": "^4.0.0",',
  '+  "@clerk/nextjs": "^6.0.0",',
].join("\n");

test("catalogFor returns the email catalog", () => {
  assert.equal(catalogFor("email"), EMAIL_TOOLS);
});

test("catalogFor rejects categories without a catalog, prototype keys included", () => {
  assert.throws(() => catalogFor("auth"), /no detection catalog for category auth/);
  assert.throws(() => catalogFor("constructor"), /no detection catalog/);
});

test("detectTools only looks for the tools of the given catalog", () => {
  assert.deepEqual(detectTools(DIFF, EMAIL_TOOLS).tools, ["resend"]);
  assert.deepEqual(detectTools(DIFF, AUTH).tools, ["clerk"]);
});

test("the schema accepts a category with a catalog", () => {
  assert.equal(ExperimentSchema.safeParse(pilot).success, true);
});

test("the schema rejects a category without a catalog", () => {
  const result = ExperimentSchema.safeParse({ ...pilot, category: "auth" });
  assert.equal(result.success, false);
  assert.deepEqual(
    result.error?.issues.map((issue) => issue.path.join(".")),
    ["category"],
  );
  assert.equal(result.error?.issues[0]?.message, "has no detection catalog (known: email)");
});
