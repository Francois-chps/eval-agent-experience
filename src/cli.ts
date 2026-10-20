/**
 * Entry point of the bench runner.
 *
 *   npm run bench -- <command> [args]
 *
 * Exit codes match scripts/check-neutrality.sh:
 *   0 = success, 1 = failure, 2 = usage error.
 */

const USAGE = `Usage: npm run bench -- <command> [args]

Commands:
  plan <experiment.yaml>   List the runs an experiment would execute
  run <experiment.yaml>    Execute the runs that are not finished yet
  help                     Show this message`;

function main(argv: readonly string[]): number {
  const [command] = argv;

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      return 0;
    case "plan":
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

process.exitCode = main(process.argv.slice(2));