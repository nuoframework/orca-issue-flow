#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { init, reconfigureRoles } from "../src/init.mjs";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8"));

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("-")));
const command = args.find((a) => !a.startsWith("-")) ?? "init";

if (flags.has("-v") || flags.has("--version")) {
  console.log(pkg.version);
  process.exit(0);
}

if (flags.has("-h") || flags.has("--help") || command === "help") {
  console.log(`
  ${pkg.name} v${pkg.version}
  ${pkg.description}

  Usage
    $ npx orca-issue-flow [command] [options]

  Commands
    init          Install the skill and write .orca-flow.yml  (default)
    roles         Re-pick the roster on an installed project. Rewrites only the
                  roles section and leaves your other edits alone.
    help          Show this

  Options
    --force       Skip the overwrite/replace confirmation
    -v, --version
    -h, --help
`);
  process.exit(0);
}

const COMMANDS = { init, roles: reconfigureRoles };

if (!COMMANDS[command]) {
  console.error(`Unknown command: ${command}\nRun \`npx ${pkg.name} --help\`.`);
  process.exit(1);
}

try {
  await COMMANDS[command]({ force: flags.has("--force") });
} catch (error) {
  console.error(`\n${error?.stack ?? error}\n`);
  process.exit(1);
}
