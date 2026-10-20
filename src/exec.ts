/**
 * Run a short external command and capture its output.
 *
 * Never throws: a command that cannot start (not installed, not
 * executable) gives code null and the reason in stderr. Callers get a
 * plain result to check, and tests can pass a fake `Run` instead.
 */
import { spawn } from "node:child_process";

export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export type Run = (command: string, args: readonly string[]) => Promise<CommandResult>;

export const runCommand: Run = (command, args) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ code: null, stdout, stderr: error.message }));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
