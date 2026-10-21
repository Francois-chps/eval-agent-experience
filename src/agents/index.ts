import { opencode } from "./opencode.ts";
import type { AgentAdapter } from "./types.ts";

// A Map, not an object: "constructor" or "toString" must not match anything.
const ADAPTERS: ReadonlyMap<string, AgentAdapter> = new Map([[opencode.id, opencode]]);

export function findAdapter(id: string): AgentAdapter | undefined {
  return ADAPTERS.get(id);
}
