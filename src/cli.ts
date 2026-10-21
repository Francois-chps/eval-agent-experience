/**
 * Entry point of the bench runner.
 *
 *   npm run bench -- <command> [args]
 *
 * Exit codes match scripts/check-neutrality.sh:
 *   0 = success, 1 = failure, 2 = usage error.
 */
import { ConfigError, loadExperiment } from "./config.ts";
import { buildPlan } from "./plan.ts";
import { loadPrompt } from "./prompt.ts";
import { runExperiment } from "./run.ts";


const USAGE = `Usage: npm run bench -- <command> [args]

Commands:
  plan <experiment.yaml>   List the runs an experiment would execute
  run <experiment.yaml>    Execute the runs that are not finished yet
  help                     Show this message`;

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...args] = argv;

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      return 0;
    case "plan":
      return plan(args);
    case "run":
      return execute(args);
    case undefined:
      console.error(USAGE);
      return 2;
    default:
      console.error(`bench: unknown command '${command}'\n\n${USAGE}`);
      return 2;
  }
}

async function plan(args: readonly string[]): Promise<number> {
  const [file] = args;
  if (file === undefined) {
    console.error(`bench: plan needs an experiment file\n\n${USAGE}`);
    return 2;
  }

  const experiment = await loadExperiment(file);
  const runs = buildPlan(experiment);

  // Check every prompt file once, before any agent could start.
  const paths = [...new Set(runs.map((run) => run.promptPath))];
  for (const path of paths) {
    const prompt = await loadPrompt(path);
    if (prompt.category !== experiment.category) {
      throw new ConfigError(
        `${path}: category is ${prompt.category}, experiment expects ${experiment.category}`,
      );
    }
  }

  for (const run of runs) {
    console.log(run.id);
  }
  console.error(
    `${runs.length} runs, ${paths.length} prompts, ${experiment.repetitions} repetition(s)`,
  );
  return 0;
}

async function execute(args: readonly string[]): Promise<number> {
  const [file] = args;
  if (file === undefined) {
    console.error(`bench: run needs an experiment file\n\n${USAGE}`);
    return 2;
  }
  return runExperiment(file);
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(`bench: ${error.message}`);
  process.exitCode = 1;
}
