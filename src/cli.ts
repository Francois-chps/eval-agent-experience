/**
 * Entry point of the bench runner.
 *
 *   npm run bench -- <command> [args]
 *
 * Exit codes match scripts/check-neutrality.sh:
 *   0 = success, 1 = failure, 2 = usage error.
 */
import { ConfigError, loadExperiment } from "./config.ts";

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
      console.error(`bench: '${command}' is not implemented yet`);
      return 1;
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
  console.log(JSON.stringify(experiment, null, 2));
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(`bench: ${error.message}`);
  process.exitCode = 1;
}
