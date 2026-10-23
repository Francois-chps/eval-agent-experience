import { test } from "node:test";
import assert from "node:assert/strict";
import { csvField, toCsv } from "../../src/report/csv.js";

test("plain values are written as is", () => {
  assert.equal(csvField("resend"), "resend");
  assert.equal(csvField(5), "5");
  assert.equal(csvField(false), "false");
  assert.equal(csvField(null), "");
});

test("commas, quotes and line breaks are quoted", () => {
  assert.equal(csvField("resend,smtp"), '"resend,smtp"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField("a\nb"), '"a\nb"');
});

test("toCsv writes a header and one line per row", () => {
  assert.equal(toCsv(["run", "tools"], [["r1", "resend,smtp"], ["r2", null]]), 'run,tools\nr1,"resend,smtp"\nr2,\n');
});
