import { test } from "node:test";
import assert from "node:assert/strict";
import { wilson } from "../../src/stats/wilson.ts";

function close(actual: number, expected: number, label: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-3, `${label}: ${actual} is not ~${expected}`);
}

function assertInterval(k: number, n: number, lower: number, upper: number): void {
  const interval = wilson(k, n);
  close(interval.rate, k / n, `${k}/${n} rate`);
  close(interval.lower, lower, `${k}/${n} lower`);
  close(interval.upper, upper, `${k}/${n} upper`);
}

test("wilson matches reference values", () => {
  assertInterval(20, 30, 0.4878, 0.8077);
  assertInterval(7, 10, 0.3968, 0.8922);
});

test("0/n has a non-zero upper bound and n/n a lower bound below 1", () => {
  assertInterval(0, 30, 0, 0.1135);
  assertInterval(30, 30, 0.8865, 1);
});

test("bounds stay inside [0, 1] and contain the rate", () => {
  for (let k = 0; k <= 10; k += 1) {
    const { rate, lower, upper } = wilson(k, 10);
    assert.ok(lower >= 0 && upper <= 1, `${k}/10 out of [0, 1]`);
    assert.ok(lower <= rate && rate <= upper, `${k}/10 does not contain its rate`);
  }
});

test("the interval is symmetric between k/n and (n-k)/n", () => {
  close(wilson(3, 10).lower, 1 - wilson(7, 10).upper, "3/10 vs 7/10");
});

test("no data gives the whole range", () => {
  assert.deepEqual(wilson(0, 0), { rate: 0, lower: 0, upper: 1 });
});

test("invalid counts are rejected", () => {
  assert.throws(() => wilson(4, 3), RangeError);
  assert.throws(() => wilson(-1, 3), RangeError);
  assert.throws(() => wilson(1.5, 3), RangeError);
});
