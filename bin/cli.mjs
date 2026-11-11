#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { init, reconfigureRoles } from "../src/init.mjs";
import { cliOptions } from "../src/cli-options.mjs";
import { upgrade } from "../src/upgrade.mjs";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8"));

let options;
try {options=cliOptions(process.argv.slice(2));}
catch(error){console.error(error.message);process.exit(1);}
const command=options.command;

if (options.version) {
  console.log(pkg.version);
  process.exit(0);
}

if (options.help || command === "help") {
  console.log(`
  ${pkg.name} v${pkg.version}
  ${pkg.description}

  Usage
    $ npx orca-issue-flow [command] [options]

  Commands
    init          Install the skill and write .orca-flow.yml  (default)
    roles         Re-pick the roster on an installed project. Rewrites only the
                  roles section and leaves your other edits alone.
    upgrade       Update installed skill(s) and add missing configuration fields.
                  Preserves existing settings; creates a backup.
    help          Show this

  Options
    --force       Skip the overwrite/replace confirmation
    --skill-only  With upgrade: refresh skill files without changing config
    --context-mode <enforced|instructed>  Explicit context-mode choice for upgrade
    --skills-path <relative-path>  With upgrade: custom skills directory
    -v, --version
    -h, --help
`);
  process.exit(0);
}

const COMMANDS = { init, roles: reconfigureRoles, upgrade };

if (!COMMANDS[command]) {
  console.error(`Unknown command: ${command}\nRun \`npx ${pkg.name} --help\`.`);
  process.exit(1);
}

try {
  await COMMANDS[command](options);
} catch (error) {
  console.error(`\n${error?.stack ?? error}\n`);
  process.exit(1);
}
