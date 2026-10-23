/**
 * Wilson score interval for a proportion k/n.
 *
 * Preferred to the normal approximation (p ± z·sqrt(p(1-p)/n)) because it stays
 * inside [0, 1] and gives a non-zero upper bound for 0/n: "never seen in 30 runs"
 * is not "never". It also behaves well on small samples such as 10 runs per persona.
 */

/** z for a two-sided 95% interval. */
export const Z95 = 1.959963984540054;

export interface Interval {
  /** Observed rate k/n. */
  readonly rate: number;
  readonly lower: number;
  readonly upper: number;
}

export function wilson(k: number, n: number, z: number = Z95): Interval {
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 0 || k > n) {
    throw new RangeError(`wilson needs integers 0 <= k <= n, got k=${k}, n=${n}`);
  }
  // No data: every rate is possible.
  if (n === 0) return { rate: 0, lower: 0, upper: 1 };

  const p = k / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
// Exact bounds at the edges: in theory lower = 0 when k = 0 and upper = 1
// when k = n, but floating-point noise can land just inside [0, 1] and
// exclude the observed rate. The clamps guard the general case.

  return { rate: p, lower: k === 0 ? 0 : Math.max(0, center - half) , upper: k === n ? 1 : Math.min(1, center + half)};
}
