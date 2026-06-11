#!/usr/bin/env node
import process from "node:process";
//import { readFile } from "node:fs/promises";
import { printHelp } from "./command/help-command.js";
import { auditCommand } from "./command/audit-command.js";
import { logger } from "@carbontrace/shared";
//fallback calibrated
//audit --pid 1234 --duration 10 --pidleW 3.2 --pmaxW 25 -v
//TDP non calibrate
//audit --pid 1234 --duration 10 --pidleW 3.2 --pmaxW 25 -v

type Command = "audit" | "monitor" | "help";

const VALID_COMMANDS = new Set<Command>([
  "audit",
  "monitor",
  "help"
]);

function isCommand(value: string): value is Command {
  return VALID_COMMANDS.has(value as Command);
}

async function main(argv: string[] = process.argv.slice(2)): Promise<void> {

  const [command = 'help', ...options] = argv;

  const jasonOutput = options.includes("--json");

  if (!jasonOutput) {
    logger.paint("============================", "blue");
    logger.paint("CarbonTrace v 0.0.1", "green");
    logger.paint("============================\n", "blue");
  }



  if (isCommand(command)) {
    switch (command) {
      case 'help':
        printHelp();
        break;
      case 'audit':
        await auditCommand(options);
        break;
      case 'monitor':
        console.log('monitor command');
        break;
    }
  } else {
    logger.error('Invalid_command');
    printHelp();
    process.exit(1);
  }
}

await main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(message);
  printHelp();
  process.exit(1);
});