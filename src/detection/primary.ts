import type { Detection, SignalKind } from "./detect.js";

/** Primary tool when several tools share the strongest evidence. */
export const AMBIGUOUS = "ambiguous";
/** Primary tool when no catalog tool was detected. */
export const NO_TOOL = "none";

/**
 * How strongly each kind of evidence shows that a tool is really used.
 * A dependency or an import is code that runs; a host is an API call; an env var is only configuration.
 */
const STRENGTH: Record<SignalKind, number> = {
  dependency: 3,
  import: 3,
  host: 2,
  env: 1,
};

/**
 * The tool a run relies on: the one with the strongest evidence.
 * The amount of evidence does not matter, only its strength: five env vars do not beat one API host.
 * On a tie the result is "ambiguous" rather than an arbitrary pick.
 */
export function primaryTool(detection: Detection): string {
  const best = new Map<string, number>();
  for (const item of detection.evidence) {
    best.set(item.tool, Math.max(best.get(item.tool) ?? 0, STRENGTH[item.kind]));
  }
  if (best.size === 0) return NO_TOOL;
  const top = Math.max(...best.values());
  const winners = [...best.keys()].filter((tool) => best.get(tool) === top);
  return winners.length === 1 ? (winners[0] ?? AMBIGUOUS) : AMBIGUOUS;
}
