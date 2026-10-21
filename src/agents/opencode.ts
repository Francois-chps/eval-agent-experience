import type { AgentAdapter } from "./types.ts";

export const opencode: AgentAdapter = {
  id: "opencode",
  versionCommand: ["opencode", "--version"],
};
