/**
 * .orca-flow.yml writer. Hand-rolled so the package stays at two dependencies and the
 * output keeps its comments — the file is meant to be edited by hand afterwards.
 */

const needsQuotes = (s) =>
  s === "" ||
  /^[\s]|[\s]$/.test(s) ||
  /^[-?:,\[\]{}#&*!|>'"%@`]/.test(s) ||
  /:\s/.test(s) ||
  /\s#/.test(s) ||
  /^(true|false|null|yes|no|on|off|~)$/i.test(s) ||
  /^-?\d+(\.\d+)?$/.test(s);

export function yamlString(value) {
  const s = String(value);
  if (!needsQuotes(s)) return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function list(items, indent) {
  if (!items || items.length === 0) return " []";
  return "\n" + items.map((i) => `${indent}- ${yamlString(i)}`).join("\n");
}

export function renderConfig(cfg) {
  const L = [];
  L.push("# orca-issue-flow — project configuration");
  L.push("# https://github.com/nuoframework/orca-issue-flow");
  L.push("#");
  L.push("# The skill reads this file at the start of every run. Edit it freely: change a");
  L.push("# model, swap an agent, add a path that must trigger the deep review. Re-run");
  L.push("# `npx orca-issue-flow` to redo the wizard.");
  L.push("");
  L.push("# --- Repository -----------------------------------------------------------");
  L.push("");
  L.push("# Branch every issue worktree is cut from, and the PR base.");
  L.push(`base_branch: ${yamlString(cfg.base_branch)}`);
  L.push(`pr_base: ${yamlString(cfg.pr_base)}`);
  L.push("# Prefix for issue branches when the tracker does not supply a name.");
  L.push(`branch_prefix: ${yamlString(cfg.branch_prefix)}`);
  L.push("");
  L.push("# Files carrying the project's rules. Every worker is told to read these first.");
  L.push(`conventions_files:${list(cfg.conventions_files, "  ")}`);
  L.push("");
  L.push("# Docs the orchestrator reads for context, and checks at the end.");
  L.push(`docs_dirs:${list(cfg.docs_dirs, "  ")}`);
  L.push(`changelog: ${cfg.changelog ? yamlString(cfg.changelog) : "null"}`);
  L.push("");
  L.push("# Language for everything YOU read: the criteria, the verdict summary, the two");
  L.push("# gate questions and the final validation. It does NOT govern the code, the");
  L.push("# commit messages, the PR title and body, or code comments — those follow the");
  L.push("# repo's own convention, and a Spanish commit in an English codebase is a");
  L.push("# regression, not a feature.");
  L.push(`language: ${yamlString(cfg.language)}`);
  L.push("");
  L.push("# --- Gates ----------------------------------------------------------------");
  L.push("");
  L.push("# Must be green before review, and again before the PR. Red gate = no review.");
  L.push("verify:");
  L.push(`  command: ${yamlString(cfg.verify.command)}`);
  if (cfg.verify.ui_command) {
    L.push("  # Run instead of the above when the diff touches UI.");
    L.push(`  ui_command: ${yamlString(cfg.verify.ui_command)}`);
  } else {
    L.push("  ui_command: null");
  }
  L.push("");
  L.push("# --- Context routing ------------------------------------------------------");
  L.push("#");
  L.push("# Machine-generated output is the cheapest thing to keep out of an expensive");
  L.push("# context window: its shape is extractable, and the original never leaves");
  L.push("# .orca-run/. roles.reader does the extraction.");
  L.push("");
  L.push("context:");
  L.push("  # Digest the verify log through roles.reader above this many lines.");
  L.push("  # 0 turns it off and the orchestrator reads the raw log.");
  L.push(`  digest_gate_logs_over: ${cfg.context.digest_gate_logs_over}`);
  L.push("  # Hand the implementer the raw log once the same failure has survived this");
  L.push("  # many rounds. Two digests that did not unblock it mean the digest is not");
  L.push("  # what is in the way.");
  L.push(`  raw_log_after_rounds: ${cfg.context.raw_log_after_rounds}`);
  L.push("");
  L.push("# --- Issue tracker --------------------------------------------------------");
  L.push("");
  L.push("# linear | github | none");
  L.push(`tracker: ${yamlString(cfg.tracker)}`);
  L.push(`issue_prefix: ${cfg.issue_prefix ? yamlString(cfg.issue_prefix) : "null"}`);
  L.push("");
  L.push("# --- Review policy --------------------------------------------------------");
  L.push("");
  L.push("# A diff touching any of these always gets the deep review, whatever its size.");
  L.push(`deep_review_paths:${list(cfg.deep_review_paths, "  ")}`);
  L.push("# ...and so does any diff bigger than this many changed lines.");
  L.push(`deep_review_lines: ${cfg.deep_review_lines}`);
  L.push("");
  L.push("# Subjects that additionally earn the adversarial reviewer.");
  L.push(`adversarial_topics:${list(cfg.adversarial_topics, "  ")}`);
  L.push("");
  L.push("# Fix rounds before the orchestrator stops and escalates to you.");
  L.push(`max_review_rounds: ${cfg.max_review_rounds}`);
  L.push("");
  L.push(renderRolesSection(cfg));
  return L.join("\n");
}

/** Marks where the roles section starts, so `orca-issue-flow roles` can replace just it. */
export const ROLES_SECTION_MARKER =
  "# --- Roles ----------------------------------------------------------------";

/**
 * Always last in the file, and always rendered by this one function — that is what lets
 * `orca-issue-flow roles` rewrite the roster without touching a single hand edit above it.
 */
export function renderRolesSection(cfg) {
  const L = [];
  L.push(ROLES_SECTION_MARKER);
  L.push("#");
  L.push("# `launch` is the command the orchestrator runs; it appends --task/--worktree/--json.");
  L.push("# `fallback` is used when a model reports being at capacity or over its limit.");
  L.push("# What matters is that the roles stay independent: two planners that think alike");
  L.push("# produce one plan, and a reviewer sharing the implementer's family finds nothing.");
  L.push("#");
  L.push("# Re-pick this roster any time with `npx orca-issue-flow roles`. It rewrites this");
  L.push("# section only and leaves everything above untouched.");
  L.push("");
  L.push("# The orchestrator is whatever session you run the skill from, so this is a note");
  L.push("# to yourself, not a launcher. The skill checks it at step 0 and says something");
  L.push("# if you are running a twelve-phase orchestration from a small model.");
  L.push(`orchestrator: ${yamlString(cfg.orchestrator ?? "a frontier model (Opus, Fable)")}`);
  L.push("");
  L.push("roles:");
  for (const role of cfg.roles) {
    L.push(`  ${role.key}:`);
    L.push(`    label: ${yamlString(role.label)}`);
    L.push(`    launch: ${yamlString(role.launch)}`);
    L.push(`    fallback: ${role.fallback ? yamlString(role.fallback) : "null"}`);
  }
  L.push("");
  return L.join("\n");
}
