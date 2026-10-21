/**
 * Run a short external command and capture its output.
 *
 * Never throws: a command that cannot start (not installed, not
 * executable) gives code null and the reason in stderr. Callers get a
 * plain result to check, and tests can pass a fake `Run` instead.
 */
import { spawn } from "node:child_process";
import { open, type FileHandle } from "node:fs/promises";

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

  /** A command that may run for a long time, such as one agent turn. */
export interface LongCommand {
  command: string;
  args: readonly string[];
  /** Files that receive stdout and stderr while the command runs. */
  stdoutPath: string;
  stderrPath: string;
  /** Seconds before the command is stopped with SIGTERM. */
  timeoutS: number;
  /** Seconds between SIGTERM and SIGKILL if the command ignores SIGTERM. */
  killGraceS?: number;
}

export interface LongResult {
  /** Exit code, or null if the command was killed or could not start. */
  code: number | null;
  seconds: number;
  timedOut: boolean;
  /** Why the command could not start, or null. */
  error: string | null;
}

/**
 * Run a long command and stream its output straight to files.
 *
 * The child writes to the files itself, so nothing is held in memory and
 * whatever it wrote before a timeout is kept. Never throws, like runCommand.
 */
export async function runLongCommand(spec: LongCommand): Promise<LongResult> {
  const started = performance.now();
  const seconds = () => Math.round(performance.now() - started) / 1000;
  let out: FileHandle | undefined;
  let err: FileHandle | undefined;
  try {
    out = await open(spec.stdoutPath, "w");
    err = await open(spec.stderrPath, "w");
    return await waitForExit(spec, out.fd, err.fd, seconds);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { code: null, seconds: seconds(), timedOut: false, error: message };
  } finally {
    await out?.close();
    await err?.close();
  }
}

function waitForExit(
  spec: LongCommand,
  stdoutFd: number,
  stderrFd: number,
  seconds: () => number,
): Promise<LongResult> {
  return new Promise((resolve) => {
    const child = spawn(spec.command, spec.args, { stdio: ["ignore", stdoutFd, stderrFd] });
    let timedOut = false;
    let killer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killer = setTimeout(() => child.kill("SIGKILL"), (spec.killGraceS ?? 5) * 1000);
    }, spec.timeoutS * 1000);

    // "error" (could not start) and "close" can both fire: the first one wins.
    const finish = (code: number | null, error: string | null) => {
      clearTimeout(timer);
      clearTimeout(killer);
      resolve({ code, seconds: seconds(), timedOut, error });
    };
    child.on("error", (error) => finish(null, error.message));
    child.on("close", (code) => finish(code, null));
  });
}
